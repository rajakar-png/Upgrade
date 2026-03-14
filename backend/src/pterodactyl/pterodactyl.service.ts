import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

interface NodeDaemonInfo {
  fqdn: string;
  scheme: string;
  port: number;
  token: string;
}

@Injectable()
export class PterodactylService {
  private readonly api: AxiosInstance;
  private readonly pteroUrl: string;
  private readonly logger = new Logger(PterodactylService.name);

  /** Cache: nodeId -> daemon info (token, fqdn, port) */
  private nodeCache = new Map<number, { info: NodeDaemonInfo; ts: number }>();
  private readonly NODE_CACHE_TTL = 5 * 60 * 1000; // 5 min

  /** Cache: pterodactylServerId -> { uuid, identifier, node } */
  private serverInfoCache = new Map<number, { uuid: string; identifier: string; node: number; ts: number }>();
  private readonly SERVER_CACHE_TTL = 10 * 60 * 1000; // 10 min

  // ── Circuit breaker state ────────────────────────────────────────────────
  private circuitFailures = 0;
  private circuitOpenedAt: number | null = null;
  private readonly CIRCUIT_THRESHOLD = 5;
  private readonly CIRCUIT_RESET_MS = 30_000; // 30s

  private panelErrorMessage(err: any, fallback: string): string {
    const data = err?.response?.data;
    if (!data) return fallback;
    if (typeof data?.message === 'string' && data.message.trim()) return data.message;
    const first = Array.isArray(data?.errors) ? data.errors[0] : null;
    if (typeof first?.detail === 'string' && first.detail.trim()) return first.detail;
    return fallback;
  }

  constructor(private config: ConfigService) {
    this.pteroUrl = config.get<string>('app.pterodactyl.url')!.replace(/\/$/, '');
    const apiKey = config.get<string>('app.pterodactyl.apiKey')!;

    this.api = axios.create({
      baseURL: `${this.pteroUrl}/api/application`,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  // ── Circuit breaker ─────────────────────────────────────────────────────────

  private checkCircuit(): void {
    if (this.circuitOpenedAt) {
      if (Date.now() - this.circuitOpenedAt > this.CIRCUIT_RESET_MS) {
        this.logger.warn('Circuit breaker: half-open, allowing request through');
        this.circuitOpenedAt = null;
        this.circuitFailures = 0;
      } else {
        throw new ServiceUnavailableException(
          'Pterodactyl panel is temporarily unavailable. Please try again shortly.',
        );
      }
    }
  }

  private recordSuccess(): void {
    this.circuitFailures = 0;
    this.circuitOpenedAt = null;
  }

  private recordFailure(): void {
    this.circuitFailures++;
    if (this.circuitFailures >= this.CIRCUIT_THRESHOLD) {
      this.circuitOpenedAt = Date.now();
      this.logger.error(
        `Circuit breaker OPEN after ${this.circuitFailures} consecutive failures. ` +
        `Will retry after ${this.CIRCUIT_RESET_MS / 1000}s.`,
      );
    }
  }

  // ── Retry wrapper ───────────────────────────────────────────────────────────

  private async withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    this.checkCircuit();
    for (let i = 1; i <= attempts; i++) {
      try {
        const result = await fn();
        this.recordSuccess();
        return result;
      } catch (err) {
        const shouldRetry = !err.response || RETRY_STATUS.has(err.response?.status);
        if (!shouldRetry || i === attempts) {
          this.recordFailure();
          throw err;
        }
        await new Promise((r) => setTimeout(r, 300 * i));
      }
    }
  }

  // ── Users ───────────────────────────────────────────────────────────────────

  async createUser(data: {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    password: string;
  }): Promise<number> {
    const res = await this.withRetry(() =>
      this.api.post('/users', {
        email: data.email,
        username: data.username,
        first_name: data.firstName,
        last_name: data.lastName,
        password: data.password,
      }),
    );
    return res.data.attributes.id;
  }

  async getUser(pterodactylUserId: number): Promise<{ id: number; username: string; email: string }> {
    const res = await this.withRetry(() => this.api.get(`/users/${pterodactylUserId}`));
    const attr = res.data.attributes;
    return { id: attr.id, username: attr.username, email: attr.email };
  }

  async updateUserPassword(pterodactylUserId: number, password: string): Promise<void> {
    // Pterodactyl requires email + username when updating a user.
    const user = await this.getUser(pterodactylUserId);
    await this.withRetry(() =>
      this.api.patch(`/users/${pterodactylUserId}`, {
        email: user.email,
        username: user.username,
        first_name: user.username,
        last_name: 'User',
        password,
      }),
    );
  }

  async getNodeSftpPort(nodeId: number): Promise<number> {
    try {
      const cfgRes = await this.withRetry(() =>
        this.api.get(`/nodes/${nodeId}/configuration`),
      );
      return cfgRes.data?.system?.sftp?.bind_port || 2022;
    } catch {
      return 2022;
    }
  }

  async getNodeDaemonPublic(nodeId: number): Promise<{ fqdn: string }> {
    const nodeRes = await this.withRetry(() => this.api.get(`/nodes/${nodeId}`));
    return { fqdn: nodeRes.data.attributes.fqdn };
  }

  async getUserByEmail(email: string): Promise<number | null> {
    try {
      const res = await this.api.get(`/users?filter[email]=${encodeURIComponent(email)}`);
      const users = res.data?.data || [];
      return users.length > 0 ? users[0].attributes.id : null;
    } catch {
      return null;
    }
  }

  async deleteUser(pterodactylUserId: number): Promise<void> {
    await this.withRetry(() => this.api.delete(`/users/${pterodactylUserId}`));
  }

  // ── Servers ─────────────────────────────────────────────────────────────────

  async createServer(data: {
    name: string;
    userId: number;
    ram: number;
    cpu: number;
    storage: number;
    swap: number;
    eggId: number;
    dockerImage: string;
    startup: string;
    environment: Record<string, string>;
    allocationId: number;
    backupLimit?: number;
    extraPorts?: number;
  }) {
    const res = await this.withRetry(() =>
      this.api.post('/servers', {
        name: data.name,
        user: data.userId,
        egg: data.eggId,
        docker_image: data.dockerImage,
        startup: data.startup,
        environment: data.environment,
        limits: {
          memory: Math.round(data.ram * 1024),
          swap: data.swap,
          disk: Math.round(data.storage * 1024),
          io: 500,
          cpu: data.cpu,
        },
        feature_limits: {
          databases: 0,
          backups: data.backupLimit || 0,
          allocations: 1 + (data.extraPorts || 0),
        },
        allocation: { default: data.allocationId },
        start_on_completion: true,
      }),
    );
    return {
      id: res.data.attributes.id as number,
      identifier: res.data.attributes.identifier as string,
    };
  }

  async suspendServer(pterodactylId: number): Promise<void> {
    await this.withRetry(() => this.api.post(`/servers/${pterodactylId}/suspend`));
  }

  async unsuspendServer(pterodactylId: number): Promise<void> {
    await this.withRetry(() => this.api.post(`/servers/${pterodactylId}/unsuspend`));
  }

  async deleteServer(pterodactylId: number): Promise<void> {
    await this.withRetry(() => this.api.delete(`/servers/${pterodactylId}/force`));
  }

  async getServerDetails(pterodactylId: number) {
    const res = await this.withRetry(() => this.api.get(`/servers/${pterodactylId}`));
    return res.data.attributes;
  }

  // ── Nodes ───────────────────────────────────────────────────────────────────

  async getNodes() {
    const res = await this.withRetry(() => this.api.get('/nodes?include=allocations'));
    return res.data?.data || [];
  }

  async getNode(nodeId: number) {
    const res = await this.withRetry(() => this.api.get(`/nodes/${nodeId}`));
    return res.data.attributes;
  }

  async selectBestNode(locationId?: number, allowedNodeIds?: number[]): Promise<{ nodeId: number; allocationId: number }> {
    const nodes = await this.getNodes();
    let filtered = locationId
      ? nodes.filter((n: any) => n.attributes.location_id === locationId)
      : nodes;
    if (allowedNodeIds && allowedNodeIds.length > 0) {
      filtered = filtered.filter((n: any) => allowedNodeIds.includes(n.attributes.id));
    }

    let best: any = null;
    let bestScore = -1;

    for (const node of filtered) {
      const attr = node.attributes;
      if (!attr.public) continue;
      const memFree = attr.memory_overallocate
        ? attr.memory * (1 + attr.memory_overallocate / 100) - attr.allocated_resources?.memory
        : attr.memory - attr.allocated_resources?.memory;
      const score = memFree;
      if (score > bestScore) {
        bestScore = score;
        best = node;
      }
    }

    if (!best) throw new Error('No available nodes');

    const allocations = best.attributes.relationships?.allocations?.data || [];
    const freeAlloc = allocations.find((a: any) => !a.attributes.assigned);
    if (!freeAlloc) throw new Error('No free allocations on best node');

    return { nodeId: best.attributes.id, allocationId: freeAlloc.attributes.id };
  }

  // ── Nests & Eggs ────────────────────────────────────────────────────────────

  async getNests() {
    const res = await this.withRetry(() => this.api.get('/nests?include=eggs'));
    return res.data?.data || [];
  }

  async getNestEggs(nestId: number) {
    const res = await this.withRetry(() => this.api.get(`/nests/${nestId}/eggs`));
    return res.data?.data || [];
  }

  async getEgg(nestId: number, eggId: number) {
    const res = await this.withRetry(() =>
      this.api.get(`/nests/${nestId}/eggs/${eggId}?include=variables`),
    );
    return res.data.attributes;
  }

  async getEggFromAllNests(eggId: number) {
    const nests = await this.getNests();
    for (const nest of nests) {
      const eggs = nest.attributes?.relationships?.eggs?.data || [];
      const match = eggs.find((e: any) => e.attributes.id === eggId);
      if (match) {
        // Found the nest, now fetch full egg with variables
        const full = await this.getEgg(nest.attributes.id, eggId);
        return full;
      }
    }
    return null;
  }

  async findFreeAllocation(nodeId: number): Promise<number> {
    const res = await this.withRetry(() =>
      this.api.get(`/nodes/${nodeId}/allocations?per_page=500`),
    );
    const allocations = res.data?.data || [];
    const free = allocations.find((a: any) => !a.attributes.assigned);
    if (!free) throw new Error(`No free allocations on node ${nodeId}`);
    return free.attributes.id;
  }

  // ── Wings Daemon (direct-to-node) ────────────────────────────────────────

  /**
   * Get node daemon connection info (fqdn, port, token) from Application API.
   * Token comes from /configuration (daemon_token is hidden on /nodes/{id}).
   * FQDN and port come from /nodes/{id}.
   * Cached for 5 minutes per node.
   */
  private async getNodeDaemon(nodeId: number): Promise<NodeDaemonInfo> {
    const cached = this.nodeCache.get(nodeId);
    if (cached && Date.now() - cached.ts < this.NODE_CACHE_TTL) return cached.info;

    // 1. Get the daemon token from /configuration (the only place it's exposed)
    const cfgRes = await this.withRetry(() =>
      this.api.get(`/nodes/${nodeId}/configuration`),
    );
    const cfg = cfgRes.data;
    const token = cfg.token;
    if (!token) {
      throw new ServiceUnavailableException(
        `Node ${nodeId} configuration did not return a daemon token`,
      );
    }

    // 2. Get the node's fqdn, scheme, and daemon port from node details
    const nodeRes = await this.withRetry(() => this.api.get(`/nodes/${nodeId}`));
    const attr = nodeRes.data.attributes;

    const info: NodeDaemonInfo = {
      fqdn: attr.fqdn,
      scheme: attr.scheme,
      port: attr.daemon_listen,
      token,
    };

    this.logger.debug(`Node ${nodeId} daemon: ${info.scheme}://${info.fqdn}:${info.port}`);
    this.nodeCache.set(nodeId, { info, ts: Date.now() });
    return info;
  }

  /**
   * Get the server's uuid and node from Application API.
   * Cached for 10 minutes per pterodactyl server id.
   */
  async getServerInfo(pterodactylId: number): Promise<{ uuid: string; identifier: string; node: number }> {
    const cached = this.serverInfoCache.get(pterodactylId);
    if (cached && Date.now() - cached.ts < this.SERVER_CACHE_TTL) {
      return { uuid: cached.uuid, identifier: cached.identifier, node: cached.node };
    }

    const res = await this.withRetry(() => this.api.get(`/servers/${pterodactylId}`));
    const attr = res.data.attributes;
    const entry = {
      uuid: attr.uuid as string,
      identifier: attr.identifier as string,
      node: attr.node as number,
      ts: Date.now(),
    };
    this.serverInfoCache.set(pterodactylId, entry);
    return { uuid: entry.uuid, identifier: entry.identifier, node: entry.node };
  }

  async getSftpEndpoint(nodeId: number): Promise<{ host: string; port: number }> {
    const [daemon, detectedPort] = await Promise.all([
      this.getNodeDaemonPublic(nodeId),
      this.getNodeSftpPort(nodeId),
    ]);

    const overrideHost = (this.config.get<string>('app.pterodactyl.sftpHost') || '').trim();
    const overridePort = Number(this.config.get<number>('app.pterodactyl.sftpPort') || 0);

    return {
      host: overrideHost || daemon.fqdn,
      port: overridePort > 0 ? overridePort : detectedPort,
    };
  }

  /**
   * Create an axios instance pointing at the Wings daemon for a specific server.
   * Auth: Bearer {daemon_token} (raw token = panel-level access on Wings)
   */
  private async wingsApi(pterodactylId: number): Promise<{ ax: AxiosInstance; uuid: string }> {
    const { uuid, node } = await this.getServerInfo(pterodactylId);
    const daemon = await this.getNodeDaemon(node);
    const baseURL = `${daemon.scheme}://${daemon.fqdn}:${daemon.port}`;
    this.logger.debug(`Wings API → ${baseURL} | server ${uuid}`);
    const ax = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${daemon.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
    return { ax, uuid };
  }

  // ── Backups (via Wings) ─────────────────────────────────────────────────

  async createBackup(pterodactylId: number, backupUuid: string) {
    const { ax, uuid } = await this.wingsApi(pterodactylId);
    await this.withRetry(() =>
      ax.post(`/api/servers/${uuid}/backup`, {
        adapter: 'wings',
        uuid: backupUuid,
        ignore: '',
      }),
    );
  }

  async deleteBackup(pterodactylId: number, backupUuid: string): Promise<void> {
    const { ax, uuid } = await this.wingsApi(pterodactylId);
    await this.withRetry(() =>
      ax.delete(`/api/servers/${uuid}/backup/${backupUuid}`),
    );
  }

  async getBackupDownloadUrl(pterodactylId: number, backupUuid: string): Promise<string> {
    const { uuid, node } = await this.getServerInfo(pterodactylId);
    const daemon = await this.getNodeDaemon(node);

    // Wings download endpoint validates a JWT signed with the node daemon token
    const dlToken = jwt.sign(
      {
        server_uuid: uuid,
        backup_uuid: backupUuid,
        unique_id: randomUUID(),
      },
      daemon.token,
      { expiresIn: '15m', algorithm: 'HS256' },
    );

    return `${daemon.scheme}://${daemon.fqdn}:${daemon.port}/download/backup?token=${dlToken}`;
  }

  // ── Console / Power (via Wings) ─────────────────────────────────────────

  async sendPowerAction(pterodactylId: number, action: 'start' | 'stop' | 'restart' | 'kill') {
    const { ax, uuid } = await this.wingsApi(pterodactylId);
    await this.withRetry(() =>
      ax.post(`/api/servers/${uuid}/power`, { action }),
    );
  }

  async getResourceUsage(pterodactylId: number) {
    const { ax, uuid } = await this.wingsApi(pterodactylId);
    const res = await this.withRetry(() => ax.get(`/api/servers/${uuid}`));
    const data = res.data;
    return {
      current_state: data.state,
      resources: {
        cpu_absolute: data.utilization?.cpu_absolute ?? 0,
        memory_bytes: data.utilization?.memory_bytes ?? 0,
        disk_bytes: data.utilization?.disk_bytes ?? 0,
        network_rx_bytes: data.utilization?.network?.rx_bytes ?? 0,
        network_tx_bytes: data.utilization?.network?.tx_bytes ?? 0,
        uptime: data.utilization?.uptime ?? 0,
      },
    };
  }

  /**
   * Get console log lines via Wings HTTP API.
   * Wings exposes GET /api/servers/{uuid}/logs?size=N (max 512).
   * Authenticated with the node daemon token (not per-server token).
   */
  async getServerLogs(pterodactylId: number, size = 200): Promise<string[]> {
    const { ax, uuid } = await this.wingsApi(pterodactylId);
    const clamped = Math.min(Math.max(size, 1), 512);
    const res = await this.withRetry(() =>
      ax.get(`/api/servers/${uuid}/logs`, { params: { size: clamped } }),
    );
    return res.data?.data || [];
  }

  // ── Files (via Wings) ─────────────────────────────────────────────────────

  async listFiles(pterodactylId: number, directory = '/') {
    const { ax, uuid } = await this.wingsApi(pterodactylId);
    const res = await this.withRetry(() =>
      ax.get(`/api/servers/${uuid}/files/list-directory`, {
        params: { directory },
      }),
    );
    // Wings returns array directly (not wrapped in data.data)
    const files = res.data || [];
    return files.map((f: any) => ({
      attributes: {
        name: f.name,
        mode: f.mode,
        mode_bits: f.mode_bits,
        size: f.size,
        is_file: f.file,
        is_symlink: f.symlink,
        mimetype: f.mime,
        created_at: f.created,
        modified_at: f.modified,
      },
    }));
  }

  async getFileContents(pterodactylId: number, filePath: string) {
    const { ax, uuid } = await this.wingsApi(pterodactylId);
    const res = await this.withRetry(() =>
      ax.get(`/api/servers/${uuid}/files/contents`, {
        params: { file: filePath },
        headers: { Accept: 'text/plain' },
        responseType: 'text',
      }),
    );
    return res.data;
  }

  async writeFile(pterodactylId: number, filePath: string, content: string) {
    const { ax, uuid } = await this.wingsApi(pterodactylId);
    await this.withRetry(() =>
      ax.post(
        `/api/servers/${uuid}/files/write`,
        content,
        { params: { file: filePath }, headers: { 'Content-Type': 'text/plain' } },
      ),
    );
  }

  async deleteFiles(pterodactylId: number, root: string, files: string[]) {
    const { ax, uuid } = await this.wingsApi(pterodactylId);
    await this.withRetry(() =>
      ax.post(`/api/servers/${uuid}/files/delete`, { root, files }),
    );
  }

  async createDirectory(pterodactylId: number, root: string, name: string) {
    const { ax, uuid } = await this.wingsApi(pterodactylId);
    await this.withRetry(() =>
      ax.post(`/api/servers/${uuid}/files/create-directory`, { name, path: root }),
    );
  }

  async renameFile(pterodactylId: number, root: string, from: string, to: string) {
    const { ax, uuid } = await this.wingsApi(pterodactylId);
    await this.withRetry(() =>
      ax.put(`/api/servers/${uuid}/files/rename`, {
        root,
        files: [{ from, to }],
      }),
    );
  }

  async getFileUploadUrl(pterodactylId: number) {
    const { uuid, node } = await this.getServerInfo(pterodactylId);
    const daemon = await this.getNodeDaemon(node);
    // Wings upload endpoint — needs the token as query param
    return `${daemon.scheme}://${daemon.fqdn}:${daemon.port}/api/servers/${uuid}/files/write?token=${daemon.token}`;
  }

  /**
   * Download a file from a URL and write it to the server via Wings.
   * Used for plugin/mod installation from Modrinth/CurseForge.
   */
  async downloadFileToServer(
    pterodactylId: number,
    downloadUrl: string,
    targetPath: string,
  ): Promise<void> {
    // Download the file
    const response = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 120000, // 2 min for large mods
      maxRedirects: 5,
    });

    const { ax, uuid } = await this.wingsApi(pterodactylId);

    // Write binary content via Wings write endpoint
    await this.withRetry(() =>
      ax.post(
        `/api/servers/${uuid}/files/write`,
        response.data,
        {
          params: { file: targetPath },
          headers: { 'Content-Type': 'application/octet-stream' },
          maxBodyLength: 200 * 1024 * 1024, // 200MB
        },
      ),
    );
  }

  // ── Command (via Wings) ─────────────────────────────────────────────────

  async sendCommand(pterodactylId: number, command: string) {
    const { ax, uuid } = await this.wingsApi(pterodactylId);
    await this.withRetry(() =>
      ax.post(`/api/servers/${uuid}/commands`, { commands: [command] }),
    );
  }

  // ── Startup / Variables (Application API — these are panel-level) ───────

  private extractStartupAttributes(payload: any): any {
    return payload?.attributes || payload?.data?.attributes || payload || {};
  }

  private extractStartupVariables(payload: any): any[] {
    const attr = this.extractStartupAttributes(payload);
    const candidates = [
      attr?.relationships?.variables?.data,
      attr?.variables?.data,
      attr?.variables,
      payload?.data?.variables,
      payload?.variables,
    ];
    const raw = candidates.find((c) => Array.isArray(c)) || [];
    return raw.map((v: any) => (v?.attributes ? v.attributes : v));
  }

  private extractStartupEnvironment(payload: any): Record<string, string> {
    const attr = this.extractStartupAttributes(payload);
    const env = attr?.environment || payload?.environment || {};
    if (!env || typeof env !== 'object') return {};
    return Object.fromEntries(
      Object.entries(env).map(([k, v]) => [k, String(v ?? '')]),
    );
  }

  private async fetchStartupSnapshot(pterodactylId: number): Promise<{
    startup: string;
    egg?: number;
    image: string;
    vars: any[];
    environment: Record<string, string>;
  }> {
    let startupRes: any = null;
    let includeRes: any = null;
    let lastErr: any;

    try {
      startupRes = await this.withRetry(() => this.api.get(`/servers/${pterodactylId}/startup`));
    } catch (err: any) {
      lastErr = err;
    }

    try {
      includeRes = await this.withRetry(() =>
        this.api.get(`/servers/${pterodactylId}?include=variables`),
      );
    } catch (err: any) {
      if (!lastErr) lastErr = err;
    }

    if (!startupRes && !includeRes) {
      throw new BadRequestException(this.panelErrorMessage(lastErr, 'Failed to fetch startup variables from panel'));
    }

    const preferred = startupRes?.data || includeRes?.data;
    const secondary = includeRes?.data || startupRes?.data;
    const attrA = this.extractStartupAttributes(preferred);
    const attrB = this.extractStartupAttributes(secondary);

    const varsA = this.extractStartupVariables(preferred);
    const varsB = this.extractStartupVariables(secondary);
    const vars = varsA.length > 0 ? varsA : varsB;

    const environment = {
      ...this.extractStartupEnvironment(secondary),
      ...this.extractStartupEnvironment(preferred),
    };

    const startup =
      attrA?.startup_command ||
      attrA?.startup ||
      attrA?.container?.startup_command ||
      attrB?.startup_command ||
      attrB?.startup ||
      attrB?.container?.startup_command ||
      '';

    const egg = attrA?.egg || attrA?.egg_id || attrB?.egg || attrB?.egg_id;
    const image =
      attrA?.docker_image ||
      attrA?.image ||
      attrA?.container?.image ||
      attrB?.docker_image ||
      attrB?.image ||
      attrB?.container?.image ||
      '';

    return { startup, egg, image, vars, environment };
  }

  async getStartup(pterodactylId: number) {
    const snapshot = await this.fetchStartupSnapshot(pterodactylId);
    const vars = snapshot.vars;
    return {
      data: vars.map((v: any) => ({
        attributes: {
          env_variable: v.env_variable,
          name: v.name,
          description: v.description,
          default_value: v.default_value,
          server_value: v.server_value,
          is_editable: v.user_editable ?? v.is_editable ?? true,
          rules: v.rules,
        },
      })),
    };
  }

  async updateStartupVariable(pterodactylId: number, key: string, value: string) {
    const trimmedKey = (key || '').trim();
    const trimmedValue = (value || '').trim();
    if (!trimmedKey) throw new BadRequestException('Startup variable key is required');
    if (!trimmedValue) throw new BadRequestException('Startup variable value is required');

    const snapshot = await this.fetchStartupSnapshot(pterodactylId);
    const vars = snapshot.vars;
    const variable = vars.find((v: any) => v.env_variable === trimmedKey);

    if (!variable && !(trimmedKey in snapshot.environment)) {
      throw new BadRequestException(`Variable ${trimmedKey} not found on this server`);
    }

    const editable = variable?.user_editable ?? variable?.is_editable ?? true;
    if (!editable) {
      throw new BadRequestException(`Variable ${trimmedKey} is not editable for this server`);
    }

    const normalizedEnv: Record<string, string> = {
      ...snapshot.environment,
    };

    for (const v of vars) {
      const keyName = v.env_variable;
      if (!keyName) continue;
      const raw = keyName === trimmedKey
        ? trimmedValue
        : (v.server_value ?? v.default_value ?? normalizedEnv[keyName] ?? '');
      normalizedEnv[keyName] = String(raw ?? '');
    }

    // Ensure target key is always included even if not exposed in vars list.
    normalizedEnv[trimmedKey] = trimmedValue;

    const startupCmd = snapshot.startup;
    const eggId = snapshot.egg;
    const image = snapshot.image;

    // Different panel versions/eggs can be strict about accepted keys.
    const payloadCandidates = [
      {
        ...(startupCmd ? { startup: startupCmd } : {}),
        ...(eggId ? { egg: eggId } : {}),
        ...(image ? { docker_image: image } : {}),
        environment: normalizedEnv,
      },
      {
        ...(startupCmd ? { startup: startupCmd } : {}),
        ...(eggId ? { egg: eggId } : {}),
        ...(image ? { image } : {}),
        environment: normalizedEnv,
      },
      {
        ...(startupCmd ? { startup: startupCmd } : {}),
        environment: normalizedEnv,
      },
    ];

    // Prefer PATCH, fallback to PUT; within each method try compatible payload shapes.
    let updateRes: any;
    let lastErr: any;
    const methods: Array<'patch' | 'put'> = ['patch', 'put'];

    for (const method of methods) {
      for (const payload of payloadCandidates) {
        try {
          updateRes = await this.withRetry(() =>
            this.api.request({ method, url: `/servers/${pterodactylId}/startup`, data: payload }),
          );
          return updateRes.data;
        } catch (err: any) {
          lastErr = err;
          const status = err?.response?.status;
          // Continue trying fallbacks for validation/method-shape errors.
          if ([400, 404, 405, 422].includes(status)) {
            continue;
          }
          throw new BadRequestException(this.panelErrorMessage(err, 'Failed to update startup variable'));
        }
      }
    }

    throw new BadRequestException(this.panelErrorMessage(lastErr, 'Failed to update startup variable'));
  }

  // ── Settings (Application API) ──────────────────────────────────────────

  async renameServer(pterodactylId: number, name: string) {
    const res = await this.withRetry(() => this.api.get(`/servers/${pterodactylId}`));
    const attr = res.data.attributes;
    await this.withRetry(() =>
      this.api.patch(`/servers/${pterodactylId}/details`, {
        name,
        user: attr.user,
        external_id: attr.external_id || '',
        description: attr.description || '',
      }),
    );
  }

  async reinstallServer(pterodactylId: number) {
    // Wings reinstall endpoint
    const { ax, uuid } = await this.wingsApi(pterodactylId);
    await this.withRetry(() => ax.post(`/api/servers/${uuid}/install`));
  }

  // ── Network (Application API — allocations) ────────────────────────────

  private isUnroutableIp(ip: string): boolean {
    return !ip || ip === '0.0.0.0' || ip === '127.0.0.1' || ip.startsWith('0.');
  }

  async listAllocations(pterodactylId: number) {
    const res = await this.withRetry(() =>
      this.api.get(`/servers/${pterodactylId}?include=allocations`),
    );
    const allocs = res.data.attributes.relationships?.allocations?.data || [];

    // Resolve the real public host: ip_alias > node FQDN > raw ip
    const { node } = await this.getServerInfo(pterodactylId);
    let nodeFqdn: string | null = null;
    try {
      const daemon = await this.getNodeDaemon(node);
      nodeFqdn = daemon.fqdn;
    } catch {}

    return allocs.map((a: any) => {
      const attr = a.attributes;
      let host = attr.ip_alias || attr.ip;
      if (this.isUnroutableIp(host) && nodeFqdn) {
        host = nodeFqdn;
      }
      return { ...a, attributes: { ...attr, resolved_host: host } };
    });
  }

  getPanelUrl() {
    return this.pteroUrl;
  }
}
