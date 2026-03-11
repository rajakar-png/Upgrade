import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, role: true, coins: true, balance: true,
        oauthProvider: true, emailVerified: true, createdAt: true,
      },
    });
  }

  async getServersCount(userId: number) {
    return this.prisma.server.count({ where: { userId, status: 'active' } });
  }
}
