import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UtrStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BILLING_UTR_SUBMITTED } from '../events/events';

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async getUpiDetails() {
    return {
      upiId: process.env.UPI_ID || '',
      upiName: process.env.UPI_NAME || '',
    };
  }

  async submitUtr(userId: number, amount: number, utrNumber: string, screenshotPath: string) {
    const submission = await this.prisma.utrSubmission.create({
      data: { userId, amount, utrNumber, screenshotPath, status: UtrStatus.pending },
      include: { user: { select: { email: true } } },
    });

    // Emit event for notifications (decoupled from Discord)
    this.eventEmitter.emit(BILLING_UTR_SUBMITTED, {
      id: submission.id,
      amount: submission.amount,
      utrNumber: submission.utrNumber,
      screenshotPath: submission.screenshotPath,
      user: submission.user,
    });

    return submission;
  }

  async getUserSubmissions(userId: number) {
    return this.prisma.utrSubmission.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
