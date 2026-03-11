import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PterodactylService } from '../pterodactyl/pterodactyl.service';
import { ConfigService } from '@nestjs/config';
import { PlanType, ServerStatus, PlanCategory } from '@prisma/client';
import { PurchaseServerDto } from './dto/server.dto';
import { addDays } from '../utils/date.util';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

@Injectable()
export class ServersService {
  constructor(
    private prisma: PrismaService,
    private pterodactyl: PterodactylService,
    private config: ConfigService,
  ) {}

  async getAvailableNodes() {
    const nodes = await this.pterodactyl.getNodes();
    return nodes
      .filter((n: any) => n.attributes.public)
      .map((n: any) => {
        const allocations = n.attributes.relationships?.allocations?.data || [];
        const freeAllocations = allocations.filter((a: any) => !a.attributes.assigned).length;
        return {
          id: n.attributes.id,
          name: n.attributes.name,
          locationId: n.attributes.location_id,
          location: n.attributes.description || n.attributes.name,
          fqdn: n.attributes.fqdn,
          freeAllocations,
        };
      });
  }

  async getAvailableEggs(category?: string) {
    const nests = await this.pterodactyl.getNests();
    const result = nests.map((nest: any) => {
      const attr = nest.attributes;
      const eggs = attr.relationships?.eggs?.data || [];
      // Determine nest category from name: nests containing "minecraft" → minecraft, rest → bot
      const nestName = (attr.name || '').toLowerCase();
      const nestCategory = nestName.includes('minecraft') ? 'minecraft' : 'bot';
      return {
        nestId: attr.id,
        nestName: attr.name,
        nestDescription: attr.description,
        category: nestCategory,
        eggs: eggs.map((egg: any) => ({
          id: egg.attributes.id,
          name: egg.attributes.name,
          description: egg.attributes.description,
          dockerImage: egg.attributes.docker_image,
        })),
      };
    });
    if (category) {
      return result.filter((n: any) => n.category === category);
    }
    return result;
  }

  async getUserServers(userId: number, page = 1, limit = DEFAULT_PAGE_SIZE) {
    const take = Math.min(limit, MAX_PAGE_SIZE);
    const skip = (page - 1) * take;

    const [servers, total] = await this.prisma.$transaction([
      this.prisma.server.findMany({
        where: { userId, status: { not: ServerStatus.deleted } },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          planCoin: { select: { name: true, ram: true, cpu: true, storage: true, durationType: true } },
          planReal: { select: { name: true, ram: true, cpu: true, storage: true, durationType: true } },
        },
      }),
      this.prisma.server.count({
        where: { userId, status: { not: ServerStatus.deleted } },
      }),
    ]);

    return {
      servers,
      pagination: { page, limit: take, total, pages: Math.ceil(total / take) },
    };
  }

  async getServerById(serverId: number, userId: number) {
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
      include: {
        planCoin: true,
        planReal: true,
      },
    });
    if (!server || server.status === ServerStatus.deleted) throw new NotFoundException('Server not found');
    if (server.userId !== userId) throw new ForbiddenException();

    // Eagerly fetch connection address from Pterodactyl
    let connectionAddress: string | null = null;
    if (server.pterodactylServerId) {
      try {
        const allocs = await this.pterodactyl.listAllocations(server.pterodactylServerId);
        const primary = allocs.find((a: any) => a.attributes.is_default) || allocs[0];
        if (primary) {
          connectionAddress = `${primary.attributes.resolved_host}:${primary.attributes.port}`;
        }
      } catch {
        // If panel is unreachable, just return without address
      }
    }

    return {
      ...server,
      connectionAddress,
      subdomain: (server as any).subdomain || null,
    };
  }

  async purchaseServer(userId: number, dto: PurchaseServerDto, idempotencyKey?: string) {
    // Idempotency check
    if (idempotencyKey) {
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: { userId_endpoint_key: { userId, endpoint: 'purchase', key: idempotencyKey } },
      });
      if (existing?.status === 'completed' && existing.responseJson) {
        return JSON.parse(existing.responseJson);
      }
    }

    // Ensure user has a Pterodactyl account
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, coins: true, balance: true, pterodactylUserId: true, email: true },
    });
    if (!user) throw new NotFoundException('User not found');

    let pterodactylUserId = user.pterodactylUserId;
    if (!pterodactylUserId) {
      pterodactylUserId = await this.provisionPterodactylUser(user.email, userId);
    }

    // Resolve plan
    const { plan, durationDays, costCoins, costBalance, planCoinId, planRealId } =
      await this.resolvePlan(dto, user);

    // Check stock
    if (plan.limitedStock && plan.stockAmount !== null) {
      const purchased = await this.prisma.server.count({
        where: {
          ...(dto.planType === 'coin' ? { planCoinId: dto.planId } : { planRealId: dto.planId }),
          status: { not: ServerStatus.deleted },
        },
      });
      if (purchased >= plan.stockAmount!) throw new ConflictException('Plan is out of stock');
    }

    // Deduct payment (skip if cost is 0)
    if (dto.planType === 'coin') {
      if (costCoins! > 0) {
        if (user.coins < costCoins!) throw new BadRequestException('Insufficient coins');
        await this.prisma.user.update({ where: { id: userId }, data: { coins: { decrement: costCoins! } } });
      }
    } else {
      if (costBalance! > 0) {
        if (user.balance < costBalance!) throw new BadRequestException('Insufficient balance');
        await this.prisma.user.update({ where: { id: userId }, data: { balance: { decrement: costBalance! } } });
      }
    }

    // Reserve idempotency key
    if (idempotencyKey) {
      await this.prisma.idempotencyKey.upsert({
        where: { userId_endpoint_key: { userId, endpoint: 'purchase', key: idempotencyKey } },
        create: { userId, endpoint: 'purchase', key: idempotencyKey, status: 'processing' },
        update: {},
      });
    }

    // Select node & allocation
    let allocationId: number | undefined;
    if (dto.nodeId) {
      try {
        allocationId = await this.pterodactyl.findFreeAllocation(dto.nodeId);
      } catch {
        await this.refundUser(userId, dto.planType, costCoins, costBalance);
        throw new BadRequestException('No free allocations on selected node');
      }
    } else {
      try {
        const best = await this.pterodactyl.selectBestNode();
        allocationId = best.allocationId;
      } catch {
        await this.refundUser(userId, dto.planType, costCoins, costBalance);
        throw new BadRequestException('No available nodes');
      }
    }

    const pteroDefaults = this.config.get('app.pterodactyl');
    const eggId = dto.eggId || pteroDefaults.defaultEgg;

    // Fetch actual egg details from Pterodactyl for docker image, startup, and env vars
    let dockerImage = pteroDefaults.defaultDockerImage;
    let startup = pteroDefaults.defaultStartup;
    let environment: Record<string, string> = pteroDefaults.defaultEnv || {};

    try {
      const eggDetails = await this.pterodactyl.getEggFromAllNests(eggId);
      if (eggDetails) {
        dockerImage = eggDetails.docker_image || dockerImage;
        startup = eggDetails.startup || startup;
        // Build environment from egg variables with their default values
        const eggVars = eggDetails.relationships?.variables?.data || [];
        const eggEnv: Record<string, string> = {};
        for (const v of eggVars) {
          const attr = v.attributes;
          eggEnv[attr.env_variable] = attr.default_value ?? '';
        }
        environment = { ...eggEnv, ...environment };
      }
    } catch {
      // Fall back to defaults if egg fetch fails
    }

    const expiresAt = addDays(new Date(), durationDays === 0 ? 36500 : durationDays);

    // Create Pterodactyl server
    let pteroServerId: number;
    let identifier: string;

    try {
      const result = await this.pterodactyl.createServer({
        name: dto.serverName,
        userId: pterodactylUserId,
        ram: plan.ram,
        cpu: plan.cpu,
        storage: plan.storage,
        swap: plan.swap || 0,
        eggId,
        dockerImage,
        startup,
        environment,
        allocationId,
        backupLimit: plan.backupCount || 0,
        extraPorts: plan.extraPorts || 0,
      });
      pteroServerId = result.id;
      identifier = result.identifier;
    } catch (err) {
      await this.refundUser(userId, dto.planType, costCoins, costBalance);
      if (idempotencyKey) {
        await this.prisma.idempotencyKey
          .delete({ where: { userId_endpoint_key: { userId, endpoint: 'purchase', key: idempotencyKey } } })
          .catch(() => {});
      }
      throw new BadRequestException('Failed to create server on panel');
    }

    // Save server record
    const server = await this.prisma.server.create({
      data: {
        userId,
        name: dto.serverName,
        planType: dto.planType === 'coin' ? PlanType.coin : PlanType.real,
        planCoinId,
        planRealId,
        pterodactylServerId: pteroServerId,
        identifier,
        expiresAt,
        status: ServerStatus.active,
        location: dto.location || '',
        software: dto.software || 'minecraft',
        category: (dto.category || 'minecraft') as PlanCategory,
        eggId,
      },
    });

    const payload = { server };

    if (idempotencyKey) {
      await this.prisma.idempotencyKey.update({
        where: { userId_endpoint_key: { userId, endpoint: 'purchase', key: idempotencyKey } },
        data: { status: 'completed', statusCode: 201, responseJson: JSON.stringify(payload) },
      });
    }

    return payload;
  }

  async renewServer(serverId: number, userId: number) {
    const server = await this.getServerById(serverId, userId);
    if (server.status === ServerStatus.deleted) throw new BadRequestException('Server is deleted');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true, balance: true },
    });

    const { durationDays, renewCostCoins, renewCostBalance } = await this.resolveRenewal(server);

    if (server.planType === PlanType.coin) {
      if (user!.coins < renewCostCoins!) throw new BadRequestException('Insufficient coins');
      await this.prisma.user.update({ where: { id: userId }, data: { coins: { decrement: renewCostCoins! } } });
    } else {
      if (user!.balance < renewCostBalance!) throw new BadRequestException('Insufficient balance');
      await this.prisma.user.update({ where: { id: userId }, data: { balance: { decrement: renewCostBalance! } } });
    }

    const now = new Date();
    const baseDate = server.expiresAt > now ? server.expiresAt : now;
    const newExpiry = addDays(baseDate, durationDays);

    const updated = await this.prisma.server.update({
      where: { id: serverId },
      data: {
        expiresAt: newExpiry,
        status: ServerStatus.active,
        suspendedAt: null,
        graceExpiresAt: null,
      },
    });

    if (server.status === ServerStatus.suspended && server.pterodactylServerId) {
      await this.pterodactyl.unsuspendServer(server.pterodactylServerId).catch(() => {});
    }

    return updated;
  }

  async deleteServer(serverId: number, userId: number) {
    const server = await this.getServerById(serverId, userId);

    if (server.pterodactylServerId) {
      await this.pterodactyl.deleteServer(server.pterodactylServerId).catch(() => {});
    }

    await this.prisma.server.update({
      where: { id: serverId },
      data: { status: ServerStatus.deleted },
    });

    return { message: 'Server deleted' };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async resolvePlan(dto: PurchaseServerDto, user: any) {
    if (dto.planType === 'coin') {
      const plan = await this.prisma.planCoin.findUnique({ where: { id: dto.planId } });
      if (!plan) throw new NotFoundException('Plan not found');
      const isFirstPurchase = !(await this.prisma.server.findFirst({
        where: { userId: user.id, planCoinId: plan.id },
      }));
      const costCoins = isFirstPurchase ? (plan.initialPrice ?? plan.coinPrice) : plan.coinPrice;
      const durationDays = plan.durationType === 'lifetime' ? 0 : plan.durationDays;
      return { plan, durationDays, costCoins, costBalance: undefined, planCoinId: plan.id, planRealId: undefined };
    } else {
      const plan = await this.prisma.planReal.findUnique({ where: { id: dto.planId } });
      if (!plan) throw new NotFoundException('Plan not found');
      const durationDays = plan.durationType === 'lifetime' ? 0 : plan.durationDays;
      return { plan, durationDays, costCoins: undefined, costBalance: plan.price, planCoinId: undefined, planRealId: plan.id };
    }
  }

  private async resolveRenewal(server: any) {
    if (server.planType === PlanType.coin) {
      const plan = await this.prisma.planCoin.findUnique({ where: { id: server.planCoinId } });
      if (!plan) throw new NotFoundException('Plan not found');
      const durationDays = plan.durationType === 'lifetime' ? 36500 : plan.durationDays;
      return { durationDays, renewCostCoins: plan.renewalPrice || plan.coinPrice, renewCostBalance: undefined };
    } else {
      const plan = await this.prisma.planReal.findUnique({ where: { id: server.planRealId } });
      if (!plan) throw new NotFoundException('Plan not found');
      const durationDays = plan.durationType === 'lifetime' ? 36500 : plan.durationDays;
      return { durationDays, renewCostCoins: undefined, renewCostBalance: plan.price };
    }
  }

  private async refundUser(userId: number, planType: string, coins?: number, balance?: number) {
    if (planType === 'coin' && coins) {
      await this.prisma.user.update({ where: { id: userId }, data: { coins: { increment: coins } } });
    } else if (balance) {
      await this.prisma.user.update({ where: { id: userId }, data: { balance: { increment: balance } } });
    }
  }

  private async provisionPterodactylUser(email: string, userId: number): Promise<number> {
    const { randomBytes } = await import('crypto');
    const username = email.split('@')[0].replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20) || `user${Date.now()}`;
    const password = randomBytes(24).toString('base64url');
    const pteroId = await this.pterodactyl.createUser({ email, username, firstName: username, lastName: 'User', password });
    await this.prisma.user.update({ where: { id: userId }, data: { pterodactylUserId: pteroId } });
    return pteroId;
  }
}
