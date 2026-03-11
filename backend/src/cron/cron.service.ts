import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PterodactylService } from '../pterodactyl/pterodactyl.service';
import { ConfigService } from '@nestjs/config';
import { ServerStatus } from '@prisma/client';

@Injectable()
export class ExpiryCronService {
  private readonly logger = new Logger(ExpiryCronService.name);

  constructor(
    private prisma: PrismaService,
    private pterodactyl: PterodactylService,
    private config: ConfigService,
  ) {}

  // Run every 30 minutes
  @Cron('*/30 * * * *')
  async checkExpiredServers() {
    const now = new Date();
    const gracePeriodHours = 12;

    // Find servers that are active but expired without a grace period set
    const expiredWithoutGrace = await this.prisma.server.findMany({
      where: {
        status: ServerStatus.active,
        expiresAt: { lt: now },
        graceExpiresAt: null,
      },
    });

    for (const server of expiredWithoutGrace) {
      const graceExpiry = new Date(now.getTime() + gracePeriodHours * 60 * 60 * 1000);
      await this.prisma.server.update({
        where: { id: server.id },
        data: { graceExpiresAt: graceExpiry },
      });
      this.logger.log(`Server ${server.id} entered grace period until ${graceExpiry.toISOString()}`);
    }

    // Find servers past grace period — suspend
    const pastGrace = await this.prisma.server.findMany({
      where: {
        status: ServerStatus.active,
        graceExpiresAt: { lt: now },
      },
    });

    for (const server of pastGrace) {
      try {
        if (server.pterodactylServerId) {
          await this.pterodactyl.suspendServer(server.pterodactylServerId);
        }
        await this.prisma.server.update({
          where: { id: server.id },
          data: { status: ServerStatus.suspended, suspendedAt: now },
        });
        this.logger.log(`Server ${server.id} suspended (expired)`);
      } catch (err) {
        this.logger.error(`Failed to suspend server ${server.id}: ${err.message}`);
      }
    }

    // Delete servers that were suspended and grace period has fully passed
    const suspendedPastGrace = await this.prisma.server.findMany({
      where: {
        status: ServerStatus.suspended,
        graceExpiresAt: { not: null, lt: now },
      },
    });

    for (const server of suspendedPastGrace) {
      try {
        if (server.pterodactylServerId) {
          await this.pterodactyl.deleteServer(server.pterodactylServerId).catch(() => {});
        }
        await this.prisma.server.update({
          where: { id: server.id },
          data: { status: ServerStatus.deleted },
        });
        this.logger.log(`Server ${server.id} deleted (grace period expired)`);
      } catch (err) {
        this.logger.error(`Failed to delete server ${server.id}: ${err.message}`);
      }
    }
  }

  // Clean up old idempotency keys daily
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupIdempotencyKeys() {
    const retentionDays = this.config.get<number>('app.cron.auditLogRetentionDays') || 7;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const deleted = await this.prisma.idempotencyKey.deleteMany({
      where: { status: 'completed', createdAt: { lt: cutoff } },
    });

    // Clean up old audit logs
    const auditRetention = this.config.get<number>('app.cron.auditLogRetentionDays') || 90;
    const auditCutoff = new Date(Date.now() - auditRetention * 24 * 60 * 60 * 1000);
    await this.prisma.auditLog.deleteMany({ where: { createdAt: { lt: auditCutoff } } });

    this.logger.log(`Cleanup: removed ${deleted.count} idempotency keys`);
  }
}
