import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PterodactylService } from '../pterodactyl/pterodactyl.service';
import { DnsService } from '../dns/dns.service';
import { ServerStatus } from '@prisma/client';
import { sanitizePath } from '../utils/path.util';

@Injectable()
export class ServerManageService {
  constructor(
    private prisma: PrismaService,
    private pterodactyl: PterodactylService,
    private dns: DnsService,
  ) {}

  private async getServer(serverId: number, userId: number) {
    const server = await this.prisma.server.findUnique({ where: { id: serverId } });
    if (!server || server.status === ServerStatus.deleted)
      throw new NotFoundException('Server not found');
    if (server.userId !== userId) throw new ForbiddenException();
    if (!server.pterodactylServerId)
      throw new NotFoundException('Server has no panel ID');
    return server;
  }

  /** Shorthand — every method needs the panel numeric ID */
  private pid(server: { pterodactylServerId: number | null }) {
    return server.pterodactylServerId!;
  }

  // ── Power & Console ──────────────────────────────────────────────────────

  async getResources(serverId: number, userId: number) {
    const server = await this.getServer(serverId, userId);
    return this.pterodactyl.getResourceUsage(this.pid(server));
  }

  async getLogs(serverId: number, userId: number, size?: number) {
    const server = await this.getServer(serverId, userId);
    const data = await this.pterodactyl.getServerLogs(this.pid(server), size);
    return { data };
  }

  async sendPower(serverId: number, userId: number, action: 'start' | 'stop' | 'restart' | 'kill') {
    const server = await this.getServer(serverId, userId);
    await this.pterodactyl.sendPowerAction(this.pid(server), action);
    return { message: `Power action '${action}' sent` };
  }

  async sendCommand(serverId: number, userId: number, command: string) {
    const server = await this.getServer(serverId, userId);
    await this.pterodactyl.sendCommand(this.pid(server), command);
    return { message: 'Command sent' };
  }

  // ── Files ────────────────────────────────────────────────────────────────

  async listFiles(serverId: number, userId: number, directory: string) {
    const server = await this.getServer(serverId, userId);
    const files = await this.pterodactyl.listFiles(this.pid(server), sanitizePath(directory));
    return files.map((f: any) => ({
      name: f.attributes.name,
      mode: f.attributes.mode,
      size: f.attributes.size,
      isFile: f.attributes.is_file,
      isSymlink: f.attributes.is_symlink,
      mimetype: f.attributes.mimetype,
      createdAt: f.attributes.created_at,
      modifiedAt: f.attributes.modified_at,
    }));
  }

  async getFileContents(serverId: number, userId: number, file: string) {
    const server = await this.getServer(serverId, userId);
    const content = await this.pterodactyl.getFileContents(this.pid(server), sanitizePath(file));
    return { content };
  }

  async writeFile(serverId: number, userId: number, file: string, content: string) {
    const server = await this.getServer(serverId, userId);
    await this.pterodactyl.writeFile(this.pid(server), sanitizePath(file), content);
    return { message: 'File saved' };
  }

  async deleteFiles(serverId: number, userId: number, root: string, files: string[]) {
    const server = await this.getServer(serverId, userId);
    const safeRoot = sanitizePath(root);
    const safeFiles = files.map((f) => sanitizePath(f));
    await this.pterodactyl.deleteFiles(this.pid(server), safeRoot, safeFiles);
    return { message: 'Files deleted' };
  }

  async createDirectory(serverId: number, userId: number, root: string, name: string) {
    const server = await this.getServer(serverId, userId);
    await this.pterodactyl.createDirectory(this.pid(server), sanitizePath(root), sanitizePath(name));
    return { message: 'Directory created' };
  }

  async renameFile(serverId: number, userId: number, root: string, from: string, to: string) {
    const server = await this.getServer(serverId, userId);
    await this.pterodactyl.renameFile(this.pid(server), sanitizePath(root), sanitizePath(from), sanitizePath(to));
    return { message: 'File renamed' };
  }

  async getUploadUrl(serverId: number, userId: number) {
    const server = await this.getServer(serverId, userId);
    const url = await this.pterodactyl.getFileUploadUrl(this.pid(server));
    return { url };
  }

  async installPlugin(
    serverId: number,
    userId: number,
    downloadUrl: string,
    filename: string,
    directory: string,
  ) {
    const server = await this.getServer(serverId, userId);

    // Validate directory is /plugins or /mods only
    if (directory !== '/plugins' && directory !== '/mods') {
      throw new BadRequestException('Invalid target directory');
    }

    // Validate filename ends with .jar
    if (!filename.endsWith('.jar')) {
      throw new BadRequestException('Only .jar files are allowed');
    }

    // Validate URL is from trusted sources
    const url = new URL(downloadUrl);
    const trustedHosts = [
      'cdn.modrinth.com',
      'edge.forgecdn.net',
      'mediafilez.forgecdn.net',
      'media.forgecdn.net',
    ];
    if (!trustedHosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))) {
      throw new BadRequestException('Download URL is not from a trusted source');
    }

    // Sanitize filename
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetPath = `${directory}/${safeName}`;

    await this.pterodactyl.downloadFileToServer(this.pid(server), downloadUrl, targetPath);
    return { message: `Installed ${safeName}`, path: targetPath };
  }

  // ── Startup / Variables ──────────────────────────────────────────────────

  async getStartup(serverId: number, userId: number) {
    const server = await this.getServer(serverId, userId);
    return this.pterodactyl.getStartup(this.pid(server));
  }

  async updateVariable(serverId: number, userId: number, key: string, value: string) {
    const server = await this.getServer(serverId, userId);
    return this.pterodactyl.updateStartupVariable(this.pid(server), key, value);
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  async rename(serverId: number, userId: number, name: string) {
    const server = await this.getServer(serverId, userId);
    await this.pterodactyl.renameServer(this.pid(server), name);
    await this.prisma.server.update({ where: { id: serverId }, data: { name } });
    return { message: 'Server renamed' };
  }

  async reinstall(serverId: number, userId: number) {
    const server = await this.getServer(serverId, userId);
    await this.pterodactyl.reinstallServer(this.pid(server));
    return { message: 'Server reinstalling' };
  }

  // ── EULA ─────────────────────────────────────────────────────────────────

  async checkEula(serverId: number, userId: number): Promise<{ accepted: boolean }> {
    const server = await this.getServer(serverId, userId);
    try {
      const content = await this.pterodactyl.getFileContents(this.pid(server), '/eula.txt');
      const accepted = /^eula\s*=\s*true/mi.test(content);
      return { accepted };
    } catch {
      // File doesn't exist yet (server hasn't started once) — treat as not accepted
      return { accepted: false };
    }
  }

  async acceptEula(serverId: number, userId: number): Promise<{ message: string }> {
    const server = await this.getServer(serverId, userId);
    await this.pterodactyl.writeFile(
      this.pid(server),
      '/eula.txt',
      '#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).\neula=true\n',
    );
    return { message: 'EULA accepted' };
  }

  // ── Network ──────────────────────────────────────────────────────────────

  async getNetwork(serverId: number, userId: number) {
    const server = await this.getServer(serverId, userId);
    const allocs = await this.pterodactyl.listAllocations(this.pid(server));
    return allocs.map((a: any) => ({
      id: a.attributes.id,
      ip: a.attributes.resolved_host,
      ipAlias: a.attributes.ip_alias,
      port: a.attributes.port,
      isDefault: a.attributes.is_default,
    }));
  }

  // ── SFTP ─────────────────────────────────────────────────────────────────

  async getSftpDetails(serverId: number, userId: number) {
    const server = await this.getServer(serverId, userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pterodactylUserId: true, pterodactylPassword: true },
    });
    if (!user?.pterodactylUserId) throw new NotFoundException('Pterodactyl account not provisioned');

    const [serverInfo, pteroUser] = await Promise.all([
      this.pterodactyl.getServerInfo(this.pid(server)),
      this.pterodactyl.getUser(user.pterodactylUserId),
    ]);

    const daemon = await this.pterodactyl.getNodeDaemonPublic(serverInfo.node);
    const sftpPort = await this.pterodactyl.getNodeSftpPort(serverInfo.node);

    return {
      host: daemon.fqdn,
      port: sftpPort,
      username: `${pteroUser.username}.${serverInfo.uuid}`,
      password: user.pterodactylPassword || null,
    };
  }

  async resetSftpPassword(serverId: number, userId: number) {
    const server = await this.getServer(serverId, userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pterodactylUserId: true },
    });
    if (!user?.pterodactylUserId) throw new NotFoundException('Pterodactyl account not provisioned');

    const { randomBytes } = await import('crypto');
    const newPassword = randomBytes(24).toString('base64url');

    await this.pterodactyl.updateUserPassword(user.pterodactylUserId, newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { pterodactylPassword: newPassword },
    });

    return { password: newPassword };
  }

  // ── Subdomain ────────────────────────────────────────────────────────────

  async getSubdomain(serverId: number, userId: number) {
    const server = await this.getServer(serverId, userId) as any;
    return {
      subdomain: server.subdomain || null,
      fullAddress: server.subdomain ? `${server.subdomain}.astranodes.cloud` : null,
    };
  }

  async setSubdomain(serverId: number, userId: number, subdomain: string) {
    const server = await this.getServer(serverId, userId);

    // Validate: 3-24 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphens
    const cleaned = subdomain.toLowerCase().trim();
    if (!/^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$/.test(cleaned)) {
      throw new BadRequestException(
        'Subdomain must be 3-24 characters, lowercase letters, numbers, and hyphens only (no leading/trailing hyphens)',
      );
    }

    // Reserved names
    const reserved = ['panel', 'api', 'admin', 'www', 'mail', 'ftp', 'ns1', 'ns2', 'node', 'sg1', 'us1', 'eu1'];
    if (reserved.includes(cleaned)) {
      throw new BadRequestException('This subdomain is reserved');
    }

    // Check uniqueness
    const existing = await (this.prisma.server as any).findFirst({
      where: { subdomain: cleaned, id: { not: serverId } },
    });
    if (existing) {
      throw new BadRequestException('This subdomain is already taken');
    }

    await (this.prisma.server as any).update({
      where: { id: serverId },
      data: { subdomain: cleaned },
    });

    // Create DNS records (SRV + A/CNAME) so Minecraft clients can resolve the subdomain
    try {
      const allocs = await this.pterodactyl.listAllocations(this.pid(server));
      const primary = allocs.find((a: any) => a.attributes.is_default) || allocs[0];
      if (primary) {
        const host = primary.attributes.resolved_host;
        const port = primary.attributes.port;
        await this.dns.createSubdomainRecords(cleaned, host, port);
      }
    } catch {
      // DNS record creation failed — subdomain is saved but DNS may not work
    }

    return {
      subdomain: cleaned,
      fullAddress: `${cleaned}.astranodes.cloud`,
      message: 'Subdomain set successfully',
    };
  }

  async removeSubdomain(serverId: number, userId: number) {
    const server = await this.getServer(serverId, userId) as any;
    const oldSubdomain = server.subdomain;

    await (this.prisma.server as any).update({
      where: { id: serverId },
      data: { subdomain: null },
    });

    // Remove DNS records
    if (oldSubdomain) {
      try {
        await this.dns.removeSubdomainRecords(oldSubdomain);
      } catch {
        // DNS cleanup failed — not critical
      }
    }

    return { message: 'Subdomain removed' };
  }

  // ── Players ──────────────────────────────────────────────────────────────

  async getPlayers(serverId: number, userId: number) {
    const server = await this.getServer(serverId, userId);
    const resources = await this.pterodactyl.getResourceUsage(this.pid(server));
    return {
      currentState: resources.current_state,
      players: [], // Populated via console WebSocket on frontend
    };
  }

  async kickPlayer(serverId: number, userId: number, player: string) {
    const server = await this.getServer(serverId, userId);
    await this.pterodactyl.sendCommand(this.pid(server), `kick ${player}`);
    return { message: `Kicked ${player}` };
  }

  async banPlayer(serverId: number, userId: number, player: string) {
    const server = await this.getServer(serverId, userId);
    await this.pterodactyl.sendCommand(this.pid(server), `ban ${player}`);
    return { message: `Banned ${player}` };
  }

  async opPlayer(serverId: number, userId: number, player: string) {
    const server = await this.getServer(serverId, userId);
    await this.pterodactyl.sendCommand(this.pid(server), `op ${player}`);
    return { message: `Opped ${player}` };
  }

  async deopPlayer(serverId: number, userId: number, player: string) {
    const server = await this.getServer(serverId, userId);
    await this.pterodactyl.sendCommand(this.pid(server), `deop ${player}`);
    return { message: `Deopped ${player}` };
  }
}
