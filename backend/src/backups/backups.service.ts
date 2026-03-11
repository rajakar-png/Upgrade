import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PterodactylService } from '../pterodactyl/pterodactyl.service';
import { randomUUID } from 'crypto';

@Injectable()
export class BackupsService {
  constructor(
    private prisma: PrismaService,
    private pterodactyl: PterodactylService,
  ) {}

  private async getServer(serverId: number, userId: number) {
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
      include: { planCoin: true, planReal: true },
    });
    if (!server) throw new NotFoundException('Server not found');
    if (server.userId !== userId) throw new ForbiddenException();
    if (!server.pterodactylServerId) throw new NotFoundException('Server has no panel ID');
    return server;
  }

  private getBackupLimit(server: any): number {
    return server.planCoin?.backupCount ?? server.planReal?.backupCount ?? 0;
  }

  async list(serverId: number, userId: number) {
    const server = await this.getServer(serverId, userId);
    const rows = await this.prisma.serverBackup.findMany({
      where: { serverId: server.id },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((b) => ({
      backupId: b.pterodactylBackupUuid,
      name: b.name,
      createdAt: b.createdAt.toISOString(),
      completedAt: b.createdAt.toISOString(), // tracked locally
      size: 0,
      isLocked: false,
    }));
  }

  async create(serverId: number, userId: number, name?: string) {
    const server = await this.getServer(serverId, userId);
    const limit = this.getBackupLimit(server);
    if (limit <= 0) throw new BadRequestException('Your plan does not include backups');

    const count = await this.prisma.serverBackup.count({ where: { serverId: server.id } });
    if (count >= limit) throw new BadRequestException(`Backup limit reached (${limit})`);

    const backupUuid = randomUUID();
    await this.pterodactyl.createBackup(server.pterodactylServerId!, backupUuid);
    const row = await this.prisma.serverBackup.create({
      data: {
        serverId: server.id,
        pterodactylBackupUuid: backupUuid,
        name: name || `backup-${count + 1}`,
      },
    });
    return {
      backupId: row.pterodactylBackupUuid,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
      completedAt: null,
      size: 0,
      isLocked: false,
    };
  }

  async remove(serverId: number, userId: number, backupUuid: string) {
    const server = await this.getServer(serverId, userId);
    const backup = await this.prisma.serverBackup.findFirst({
      where: { serverId: server.id, pterodactylBackupUuid: backupUuid },
    });
    if (!backup) throw new NotFoundException('Backup not found');

    await this.pterodactyl.deleteBackup(server.pterodactylServerId!, backupUuid);
    await this.prisma.serverBackup.delete({ where: { id: backup.id } });
    return { message: 'Backup deleted' };
  }

  async getDownloadUrl(serverId: number, userId: number, backupUuid: string) {
    const server = await this.getServer(serverId, userId);
    const backup = await this.prisma.serverBackup.findFirst({
      where: { serverId: server.id, pterodactylBackupUuid: backupUuid },
    });
    if (!backup) throw new NotFoundException('Backup not found');

    const url = await this.pterodactyl.getBackupDownloadUrl(server.pterodactylServerId!, backupUuid);
    return { url };
  }
}
