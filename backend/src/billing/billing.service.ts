import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UtrStatus } from '@prisma/client';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  async getUpiDetails() {
    return {
      upiId: process.env.UPI_ID || '',
      upiName: process.env.UPI_NAME || '',
    };
  }

  async submitUtr(userId: number, amount: number, utrNumber: string, screenshotPath: string) {
    return this.prisma.utrSubmission.create({
      data: { userId, amount, utrNumber, screenshotPath, status: UtrStatus.pending },
    });
  }

  async getUserSubmissions(userId: number) {
    return this.prisma.utrSubmission.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
