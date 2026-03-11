import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  async redeem(code: string, userId: number, ipAddress: string) {
    return this.prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.findUnique({ where: { code } });
      if (!coupon || !coupon.active) throw new BadRequestException('Coupon is invalid');
      if (coupon.expiresAt <= new Date()) throw new BadRequestException('Coupon is expired');

      const totalUses = await tx.couponRedemption.count({ where: { couponId: coupon.id } });
      if (totalUses >= coupon.maxUses) throw new BadRequestException('Coupon max uses reached');

      const userUses = await tx.couponRedemption.count({ where: { couponId: coupon.id, userId } });
      if (userUses >= coupon.perUserLimit) throw new BadRequestException('Coupon limit reached for this user');

      // IP abuse check: if this IP has been used by a different user for this coupon, flag both
      const ipRedemptions = await tx.couponRedemption.findMany({
        where: { couponId: coupon.id, ipAddress },
        select: { userId: true },
      });

      const otherIpUserIds = [...new Set(ipRedemptions.map((r) => r.userId))].filter((id) => id !== userId);
      if (otherIpUserIds.length > 0) {
        const allToFlag = [userId, ...otherIpUserIds];
        await tx.user.updateMany({ where: { id: { in: allToFlag } }, data: { flagged: true } });
        throw new BadRequestException('Coupon already redeemed from this IP');
      }

      // Record redemption
      await tx.couponRedemption.create({ data: { couponId: coupon.id, userId, ipAddress } });

      // Award coins
      await tx.user.update({
        where: { id: userId },
        data: { coins: { increment: coupon.coinReward } },
      });

      return { coinsAwarded: coupon.coinReward };
    });
  }
}
