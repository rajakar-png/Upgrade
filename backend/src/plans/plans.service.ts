import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  async getCoinPlans(category?: string) {
    return this.prisma.planCoin.findMany({
      where: category ? { category: category as any } : undefined,
      orderBy: { coinPrice: 'asc' },
    });
  }

  async getRealPlans(category?: string) {
    return this.prisma.planReal.findMany({
      where: category ? { category: category as any } : undefined,
      orderBy: { price: 'asc' },
    });
  }

  async getAllPlans() {
    const [coin, real] = await this.prisma.$transaction([
      this.prisma.planCoin.findMany({ orderBy: { coinPrice: 'asc' } }),
      this.prisma.planReal.findMany({ orderBy: { price: 'asc' } }),
    ]);
    return { coin, real };
  }
}
