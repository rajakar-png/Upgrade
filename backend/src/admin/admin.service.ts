import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PterodactylService } from '../pterodactyl/pterodactyl.service';
import { UtrStatus, ServerStatus, TicketStatus, PlanType } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private pterodactyl: PterodactylService,
  ) {}

  // ── Users ───────────────────────────────────────────────────────────────────

  async getUsers(page = 1, limit = 30, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? { email: { contains: search, mode: 'insensitive' as const } }
      : {};
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, role: true, coins: true, balance: true,
          flagged: true, pterodactylUserId: true, createdAt: true, oauthProvider: true,
          ipAddress: true, lastLoginIp: true,
          _count: { select: { servers: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async updateUser(userId: number, data: { coins?: number; balance?: number; role?: string; flagged?: boolean }) {
    return this.prisma.user.update({ where: { id: userId }, data: data as any });
  }

  async deleteUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, pterodactylUserId: true, servers: { where: { status: { not: ServerStatus.deleted } }, select: { id: true, pterodactylServerId: true } } },
    });
    if (!user) throw new NotFoundException('User not found');

    // Delete all user's servers from Pterodactyl
    for (const server of user.servers) {
      if (server.pterodactylServerId) {
        await this.pterodactyl.deleteServer(server.pterodactylServerId).catch(() => {});
      }
      await this.prisma.server.update({ where: { id: server.id }, data: { status: ServerStatus.deleted } });
    }

    // Delete user from Pterodactyl panel
    if (user.pterodactylUserId) {
      await this.pterodactyl.deleteUser(user.pterodactylUserId).catch(() => {});
    }

    // Delete user from database
    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'User deleted' };
  }

  async getUserServers(userId: number) {
    return this.prisma.server.findMany({
      where: { userId, status: { not: ServerStatus.deleted } },
      orderBy: { createdAt: 'desc' },
      include: {
        planCoin: { select: { name: true, ram: true, cpu: true, storage: true } },
        planReal: { select: { name: true, ram: true, cpu: true, storage: true } },
      },
    });
  }

  // ── Admin Servers ───────────────────────────────────────────────────────────

  async getAdminServers(page = 1, limit = 30, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = { status: { not: ServerStatus.deleted } };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const [servers, total] = await this.prisma.$transaction([
      this.prisma.server.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true } },
          planCoin: { select: { name: true } },
          planReal: { select: { name: true } },
        },
      }),
      this.prisma.server.count({ where }),
    ]);
    return { servers, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async adminGetServer(serverId: number) {
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
      include: {
        user: { select: { id: true, email: true } },
        planCoin: true,
        planReal: true,
      },
    });
    if (!server) throw new NotFoundException('Server not found');
    return server;
  }

  async adminSuspendServer(serverId: number) {
    const server = await this.prisma.server.findUnique({ where: { id: serverId } });
    if (!server) throw new NotFoundException('Server not found');
    if (server.pterodactylServerId) {
      await this.pterodactyl.suspendServer(server.pterodactylServerId);
    }
    return this.prisma.server.update({
      where: { id: serverId },
      data: { status: ServerStatus.suspended, suspendedAt: new Date() },
    });
  }

  async adminUnsuspendServer(serverId: number) {
    const server = await this.prisma.server.findUnique({ where: { id: serverId } });
    if (!server) throw new NotFoundException('Server not found');
    if (server.pterodactylServerId) {
      await this.pterodactyl.unsuspendServer(server.pterodactylServerId);
    }
    return this.prisma.server.update({
      where: { id: serverId },
      data: { status: ServerStatus.active, suspendedAt: null },
    });
  }

  async adminDeleteServer(serverId: number) {
    const server = await this.prisma.server.findUnique({ where: { id: serverId } });
    if (!server) throw new NotFoundException('Server not found');
    if (server.pterodactylServerId) {
      await this.pterodactyl.deleteServer(server.pterodactylServerId).catch(() => {});
    }
    await this.prisma.server.update({
      where: { id: serverId },
      data: { status: ServerStatus.deleted },
    });
    return { message: 'Server deleted' };
  }

  async syncServersWithPterodactyl() {
    const servers = await this.prisma.server.findMany({
      where: { status: { not: ServerStatus.deleted }, pterodactylServerId: { not: null } },
      select: { id: true, pterodactylServerId: true, name: true },
    });

    let synced = 0;
    for (const server of servers) {
      try {
        await this.pterodactyl.getServerDetails(server.pterodactylServerId!);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          await this.prisma.server.update({
            where: { id: server.id },
            data: { status: ServerStatus.deleted },
          });
          synced++;
        }
      }
    }
    return { message: `Sync complete. ${synced} orphaned server(s) removed.`, removed: synced };
  }

  // ── Node Allocation ─────────────────────────────────────────────────────────

  async getNodeAllocations(planType: string, planId: number) {
    const where = planType === 'coin'
      ? { planType: PlanType.coin, planCoinId: planId }
      : { planType: PlanType.real, planRealId: planId };
    return this.prisma.planNodeAllocation.findMany({ where });
  }

  async setNodeAllocations(planType: string, planId: number, nodes: { nodeId: number; nodeName?: string }[]) {
    const type = planType === 'coin' ? PlanType.coin : PlanType.real;
    const where = planType === 'coin'
      ? { planType: type, planCoinId: planId }
      : { planType: type, planRealId: planId };

    // Delete existing allocations
    await this.prisma.planNodeAllocation.deleteMany({ where });

    // Create new allocations
    if (nodes.length > 0) {
      await this.prisma.planNodeAllocation.createMany({
        data: nodes.map((n) => ({
          planType: type,
          planCoinId: planType === 'coin' ? planId : null,
          planRealId: planType === 'real' ? planId : null,
          nodeId: n.nodeId,
          nodeName: n.nodeName || '',
        })),
      });
    }
    return { message: 'Node allocations updated' };
  }

  async getAllNodeAllocations() {
    return this.prisma.planNodeAllocation.findMany({
      orderBy: [{ planType: 'asc' }, { planCoinId: 'asc' }, { planRealId: 'asc' }],
    });
  }

  // ── Plans ───────────────────────────────────────────────────────────────────

  async createCoinPlan(data: any) {
    return this.prisma.planCoin.create({ data });
  }

  async updateCoinPlan(id: number, data: any) {
    return this.prisma.planCoin.update({ where: { id }, data });
  }

  async deleteCoinPlan(id: number) {
    return this.prisma.planCoin.delete({ where: { id } });
  }

  async createRealPlan(data: any) {
    return this.prisma.planReal.create({ data });
  }

  async updateRealPlan(id: number, data: any) {
    return this.prisma.planReal.update({ where: { id }, data });
  }

  async deleteRealPlan(id: number) {
    return this.prisma.planReal.delete({ where: { id } });
  }

  // ── Coupons ─────────────────────────────────────────────────────────────────

  async getCoupons() {
    return this.prisma.coupon.findMany({
      orderBy: { id: 'desc' },
      include: { _count: { select: { redemptions: true } } },
    });
  }

  async createCoupon(data: any) {
    const { code, coinReward, maxUses, perUserLimit, expiresAt } = data;
    return this.prisma.coupon.create({
      data: { code, coinReward, maxUses, perUserLimit, expiresAt: new Date(expiresAt) },
    });
  }

  async updateCoupon(id: number, data: any) {
    return this.prisma.coupon.update({ where: { id }, data });
  }

  async deleteCoupon(id: number) {
    return this.prisma.coupon.delete({ where: { id } });
  }

  // ── Tickets ─────────────────────────────────────────────────────────────────

  async getTickets(status?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as TicketStatus } : {};
    const [tickets, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: { select: { email: true } },
          messages: { take: 1, orderBy: { createdAt: 'desc' } },
        },
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return { tickets, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getTicket(id: number) {
    return this.prisma.ticket.findUnique({
      where: { id },
      include: {
        user: { select: { email: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: { user: { select: { email: true } } } },
      },
    });
  }

  async replyTicket(ticketId: number, adminId: number, message: string) {
    const [msg] = await this.prisma.$transaction([
      this.prisma.ticketMessage.create({
        data: { ticketId, userId: adminId, message, isAdmin: true },
      }),
      this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.in_progress },
      }),
    ]);
    return msg;
  }

  async closeTicket(ticketId: number) {
    return this.prisma.ticket.update({ where: { id: ticketId }, data: { status: TicketStatus.closed } });
  }

  async updateTicketStatus(ticketId: number, status: string) {
    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('Invalid status');
    }
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: status as TicketStatus },
    });
  }

  // ── UTR Submissions ─────────────────────────────────────────────────────────

  async getUtrSubmissions(status?: string) {
    return this.prisma.utrSubmission.findMany({
      where: status ? { status: status as UtrStatus } : {},
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } } },
    });
  }

  async processUtr(id: number, approve: boolean, balanceAmount?: number) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.utrSubmission.update({
        where: { id },
        data: { status: approve ? UtrStatus.approved : UtrStatus.rejected },
      });
      if (approve && balanceAmount) {
        await tx.user.update({
          where: { id: sub.userId },
          data: { balance: { increment: balanceAmount } },
        });
      }
      return sub;
    });
  }

  // ── Coin Settings ───────────────────────────────────────────────────────────

  async getCoinSettings() {
    return this.prisma.coinSetting.upsert({
      where: { id: 1 },
      create: { id: 1, coinsPerMinute: 1 },
      update: {},
    });
  }

  async updateCoinSettings(coinsPerMinute: number) {
    return this.prisma.coinSetting.upsert({
      where: { id: 1 },
      create: { id: 1, coinsPerMinute },
      update: { coinsPerMinute },
    });
  }

  // ── Ad Settings ─────────────────────────────────────────────────────────────

  async getAdSettings() {
    return this.prisma.adSetting.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    });
  }

  async updateAdSettings(data: any) {
    const update: any = {};
    if (data.adProvider !== undefined) {
      const allowed = ['none', 'adsense', 'adsterra'];
      if (!allowed.includes(data.adProvider)) throw new BadRequestException('Invalid ad provider');
      update.adProvider = data.adProvider;
    }
    if (data.adBlockerDetection !== undefined) update.adBlockerDetection = data.adBlockerDetection === true || data.adBlockerDetection === 'true';
    if (data.requireAdView !== undefined) update.requireAdView = data.requireAdView === true || data.requireAdView === 'true';
    if (data.adsensePublisherId !== undefined) update.adsensePublisherId = data.adsensePublisherId || null;
    if (data.adsenseSlotId !== undefined) update.adsenseSlotId = data.adsenseSlotId || null;
    if (data.adsterraBannerKey !== undefined) update.adsterraBannerKey = data.adsterraBannerKey || null;
    if (data.adsterraNativeKey !== undefined) update.adsterraNativeKey = data.adsterraNativeKey || null;
    return this.prisma.adSetting.upsert({
      where: { id: 1 },
      create: { id: 1, ...update },
      update,
    });
  }

  // ── Popup Messages ──────────────────────────────────────────────────────────

  async getPopups() {
    return this.prisma.popupMessage.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createPopup(data: any) {
    return this.prisma.popupMessage.create({
      data: {
        title: data.title,
        message: data.message,
        imageUrl: data.imageUrl || null,
        enabled: data.enabled === 'true' || data.enabled === true,
        showOnce: data.showOnce === 'true' || data.showOnce === true,
        sortOrder: data.sortOrder ? parseInt(data.sortOrder) : 0,
      },
    });
  }

  async updatePopup(id: number, data: any) {
    const update: any = {};
    if (data.title !== undefined) update.title = data.title;
    if (data.message !== undefined) update.message = data.message;
    if (data.imageUrl !== undefined) update.imageUrl = data.imageUrl;
    if (data.enabled !== undefined) update.enabled = data.enabled === 'true' || data.enabled === true;
    if (data.showOnce !== undefined) update.showOnce = data.showOnce === 'true' || data.showOnce === true;
    if (data.sortOrder !== undefined) update.sortOrder = parseInt(data.sortOrder);
    return this.prisma.popupMessage.update({ where: { id }, data: update });
  }

  async deletePopup(id: number) {
    return this.prisma.popupMessage.delete({ where: { id } });
  }

  // ── Site Settings ───────────────────────────────────────────────────────────

  async updateSiteSettings(data: any, imageFilename?: string) {
    const update: any = {};
    if (data.siteName !== undefined) update.siteName = data.siteName;
    if (data.heroTitle !== undefined) update.heroTitle = data.heroTitle;
    if (data.heroSubtitle !== undefined) update.heroSubtitle = data.heroSubtitle;
    if (data.faviconPath !== undefined) update.faviconPath = data.faviconPath;
    if (data.logoPath !== undefined) update.logoPath = data.logoPath;
    if (data.discordInviteUrl !== undefined) update.discordInviteUrl = data.discordInviteUrl;
    if (data.maintenanceMode !== undefined) update.maintenanceMode = data.maintenanceMode === 'true' || data.maintenanceMode === true;
    if (data.discordPopupEnabled !== undefined) update.discordPopupEnabled = data.discordPopupEnabled === 'true' || data.discordPopupEnabled === true;
    if (data.discordBotEnabled !== undefined) update.discordBotEnabled = data.discordBotEnabled === 'true' || data.discordBotEnabled === true;
    if (data.discordBotToken !== undefined) update.discordBotToken = data.discordBotToken || null;
    if (data.discordUtrChannelId !== undefined) update.discordUtrChannelId = data.discordUtrChannelId || null;
    if (data.discordTicketChannelId !== undefined) update.discordTicketChannelId = data.discordTicketChannelId || null;
    if (data.discordPingRoleId !== undefined) update.discordPingRoleId = data.discordPingRoleId || null;
    if (data.backgroundOverlayOpacity !== undefined) update.backgroundOverlayOpacity = parseFloat(data.backgroundOverlayOpacity);
    if (imageFilename) update.backgroundImage = `/uploads/${imageFilename}`;
    if (data.backgroundImage !== undefined && !imageFilename) update.backgroundImage = data.backgroundImage;

    const existing = await this.prisma.siteSetting.findFirst();
    if (existing) {
      return this.prisma.siteSetting.update({ where: { id: existing.id }, data: update });
    }
    return this.prisma.siteSetting.create({ data: update });
  }
}
