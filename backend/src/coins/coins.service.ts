import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { randomBytes } from 'crypto';

const MIN_VIEW_MS = 4000;   // Token is invalid if claimed < 4s after issue
const TOKEN_TTL_S = 40;     // Tokens expire after 40s
const CLAIM_COOLDOWN_S = 60; // 1 minute between claims

interface EarnToken {
  userId: number;
  issuedAt: number;
}

@Injectable()
export class CoinsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getBalance(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true, balance: true, lastClaimTime: true },
    });
  }

  async issueEarnToken(userId: number, flagged: boolean): Promise<string> {
    if (flagged) throw new ForbiddenException('Account flagged. Contact support.');

    const token = randomBytes(32).toString('hex');
    const data: EarnToken = { userId, issuedAt: Date.now() };
    await this.redis.set(`earn:${token}`, JSON.stringify(data), TOKEN_TTL_S);
    return token;
  }

  async claimCoins(userId: number, token: string, flagged: boolean) {
    if (flagged) throw new ForbiddenException('Account flagged. Contact support.');

    // Validate token
    const raw = await this.redis.get(`earn:${token}`);
    if (!raw) return { error: 'Token expired or invalid', valid: false };

    const data: EarnToken = JSON.parse(raw);
    if (data.userId !== userId) return { error: 'Token user mismatch', valid: false };
    if (Date.now() - data.issuedAt < MIN_VIEW_MS) return { error: 'Must wait before claiming', valid: false };

    // Consume token (one-time use)
    await this.redis.del(`earn:${token}`);

    // Check cooldown
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastClaimTime: true },
    });

    if (user?.lastClaimTime) {
      const secondsSinceLast = (Date.now() - user.lastClaimTime.getTime()) / 1000;
      if (secondsSinceLast < CLAIM_COOLDOWN_S) {
        const waitSeconds = Math.ceil(CLAIM_COOLDOWN_S - secondsSinceLast);
        return { error: 'Cooldown active', waitSeconds, valid: false };
      }
    }

    // Award coins
    const settings = await this.prisma.coinSetting.findUnique({ where: { id: 1 } });
    const earned = settings?.coinsPerMinute || 1;

    await this.prisma.user.update({
      where: { id: userId },
      data: { coins: { increment: earned }, lastClaimTime: new Date() },
    });

    return { earned, valid: true };
  }
}
