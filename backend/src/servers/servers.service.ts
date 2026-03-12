import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PterodactylService } from '../pterodactyl/pterodactyl.service';
import { ServerStatus } from '@prisma/client';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

@Injectable()
export class ServersService {
  constructor(
    private prisma: PrismaService,
    private pterodactyl: PterodactylService,
  ) {}

  async getAvailableNodes(planType?: string, planId?: number) {
    const nodes = await this.pterodactyl.getNodes();

    // Check if plan has specific node allocations
    let allowedNodeIds: number[] | null = null;
    if (planType && planId) {
      const allocations = await this.prisma.planNodeAllocation.findMany({
        where: planType === 'coin'
          ? { planType: 'coin', planCoinId: planId }
          : { planType: 'real', planRealId: planId },
        select: { nodeId: true },
      });
      if (allocations.length > 0) {
        allowedNodeIds = allocations.map((a) => a.nodeId);
      }
    }

    return nodes
      .filter((n: any) => n.attributes.public)
      .filter((n: any) => !allowedNodeIds || allowedNodeIds.includes(n.attributes.id))
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
}
