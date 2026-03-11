import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UtrStatus, ServerStatus, TicketStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ── Dashboard stats ─────────────────────────────────────────────────────────

  async getDashboardStats() {
    const [totalUsers, totalServers, activeServers, openTickets, pendingUtrs] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.server.count(),
      this.prisma.server.count({ where: { status: ServerStatus.active } }),
      this.prisma.ticket.count({ where: { status: TicketStatus.open } }),
      this.prisma.utrSubmission.count({ where: { status: UtrStatus.pending } }),
    ]);
    // Sum approved UTR amounts as revenue
    const revenueResult = await this.prisma.utrSubmission.aggregate({
      where: { status: UtrStatus.approved },
      _sum: { amount: true },
    });
    const totalRevenue = revenueResult._sum.amount ?? 0;
    return { totalUsers, totalServers, activeServers, openTickets, pendingUtrs, totalRevenue };
  }

  // ── Users ───────────────────────────────────────────────────────────────────

  async getUsers(page = 1, limit = 20, search?: string) {
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
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async updateUser(userId: number, data: { coins?: number; balance?: number; role?: string; flagged?: boolean }) {
    return this.prisma.user.update({ where: { id: userId }, data: data as any });
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
    return this.prisma.coupon.findMany({ orderBy: { id: 'desc' } });
  }

  async createCoupon(data: any) {
    return this.prisma.coupon.create({ data });
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

  // ── Audit Log ───────────────────────────────────────────────────────────────

  async logAction(adminId: number, action: string, targetType?: string, targetId?: number, details?: string, ip?: string) {
    return this.prisma.auditLog.create({
      data: { adminId, action, targetType, targetId, details, ipAddress: ip },
    });
  }

  async getAuditLog(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [logs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { email: true } } },
      }),
      this.prisma.auditLog.count(),
    ]);
    return { logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
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
}
