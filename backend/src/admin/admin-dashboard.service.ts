import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServerStatus, TicketStatus, UtrStatus } from '@prisma/client';

@Injectable()
export class AdminDashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const [totalUsers, totalServers, activeServers, openTickets, pendingUtrs] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.server.count(),
      this.prisma.server.count({ where: { status: ServerStatus.active } }),
      this.prisma.ticket.count({ where: { status: TicketStatus.open } }),
      this.prisma.utrSubmission.count({ where: { status: UtrStatus.pending } }),
    ]);
    const revenueResult = await this.prisma.utrSubmission.aggregate({
      where: { status: UtrStatus.approved },
      _sum: { amount: true },
    });
    const totalRevenue = revenueResult._sum.amount ?? 0;
    return { totalUsers, totalServers, activeServers, openTickets, pendingUtrs, totalRevenue };
  }

  async getPublicStats() {
    const [activeUsers, activeServers] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.server.count({ where: { status: ServerStatus.active } }),
    ]);
    return { activeUsers, activeServers, uptime: '99.9%' };
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

  async logAction(adminId: number, action: string, targetType?: string, targetId?: number, details?: string, ip?: string) {
    return this.prisma.auditLog.create({
      data: { adminId, action, targetType, targetId, details, ipAddress: ip },
    });
  }
}
