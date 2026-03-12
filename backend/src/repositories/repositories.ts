import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServerStatus } from '@prisma/client';

@Injectable()
export class UserRepository {
  constructor(private prisma: PrismaService) {}

  findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByIdSelect<T extends Record<string, boolean>>(id: number, select: T) {
    return this.prisma.user.findUnique({ where: { id }, select });
  }

  findByEmail(email: string) {
    return this.prisma.user.findFirst({ where: { email } });
  }

  findByOAuth(provider: string, oauthId: string) {
    return this.prisma.user.findFirst({
      where: { oauthProvider: provider as any, oauthId },
    });
  }

  findByEmailNoProvider(email: string) {
    return this.prisma.user.findFirst({
      where: { email, oauthProvider: null },
    });
  }

  count(where?: any) {
    return this.prisma.user.count({ where });
  }

  create(data: any) {
    return this.prisma.user.create({ data });
  }

  update(id: number, data: any) {
    return this.prisma.user.update({ where: { id }, data });
  }

  delete(id: number) {
    return this.prisma.user.delete({ where: { id } });
  }

  incrementCoins(id: number, amount: number) {
    return this.prisma.user.update({
      where: { id },
      data: { coins: { increment: amount } },
    });
  }

  decrementCoins(id: number, amount: number) {
    return this.prisma.user.update({
      where: { id },
      data: { coins: { decrement: amount } },
    });
  }

  incrementBalance(id: number, amount: number) {
    return this.prisma.user.update({
      where: { id },
      data: { balance: { increment: amount } },
    });
  }

  decrementBalance(id: number, amount: number) {
    return this.prisma.user.update({
      where: { id },
      data: { balance: { decrement: amount } },
    });
  }
}

@Injectable()
export class ServerRepository {
  constructor(private prisma: PrismaService) {}

  findById(id: number) {
    return this.prisma.server.findUnique({ where: { id } });
  }

  findByIdWithPlans(id: number) {
    return this.prisma.server.findUnique({
      where: { id },
      include: { planCoin: true, planReal: true },
    });
  }

  findActiveByUser(userId: number, skip: number, take: number) {
    return this.prisma.$transaction([
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
  }

  countActive(where?: any) {
    return this.prisma.server.count({
      where: { status: { not: ServerStatus.deleted }, ...where },
    });
  }

  countByStatus(status: ServerStatus) {
    return this.prisma.server.count({ where: { status } });
  }

  create(data: any) {
    return this.prisma.server.create({ data });
  }

  update(id: number, data: any) {
    return this.prisma.server.update({ where: { id }, data });
  }

  markDeleted(id: number) {
    return this.prisma.server.update({
      where: { id },
      data: { status: ServerStatus.deleted },
    });
  }
}
