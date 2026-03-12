import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { randomBytes } from 'crypto';

const MIN_VIEW_MS = 4000;    // Token is invalid if claimed < 4s after issue
const TOKEN_DISPLAY_S = 30;  // 30s countdown timer before claim
const TOKEN_REDIS_TTL_S = 60; // Redis TTL — buffer so token survives past timer
const CLAIM_COOLDOWN_S = 10;  // 10s anti-bot cooldown between claims

interface EarnToken {
  userId: number;
  issuedAt: number;
  adRequired?: boolean;
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
      select: { coins: true },
    });
  }

  async getAdConfig() {
    const settings = await this.prisma.adSetting.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    });
    // Return only public-safe fields — no admin-only data
    return {
      adProvider: settings.adProvider,
      adBlockerDetection: settings.adBlockerDetection,
      requireAdView: settings.requireAdView,
      adsensePublisherId: settings.adsensePublisherId,
      adsenseSlotId: settings.adsenseSlotId,
      adsterraBannerKey: settings.adsterraBannerKey,
      adsterraNativeKey: settings.adsterraNativeKey,
    };
  }

  async issueEarnToken(userId: number, flagged: boolean): Promise<{ token: string; expiresAt: number }> {
    if (flagged) throw new ForbiddenException('Account flagged. Contact support.');

    // Check if ads are required
    const adSettings = await this.prisma.adSetting.findUnique({ where: { id: 1 } });
    const adRequired = adSettings?.adProvider !== 'none' && adSettings?.requireAdView === true;

    const token = randomBytes(32).toString('hex');
    const data: EarnToken = { userId, issuedAt: Date.now(), adRequired };
    await this.redis.set(`earn:${token}`, JSON.stringify(data), TOKEN_REDIS_TTL_S);
    return { token, expiresAt: Date.now() + TOKEN_DISPLAY_S * 1000 };
  }

  async claimCoins(userId: number, token: string, flagged: boolean, adViewed?: boolean) {
    if (flagged) throw new ForbiddenException('Account flagged. Contact support.');

    // Validate token
    const raw = await this.redis.get(`earn:${token}`);
    if (!raw) return { error: 'Token expired or invalid', valid: false };

    const data: EarnToken = JSON.parse(raw);
    if (data.userId !== userId) return { error: 'Token user mismatch', valid: false };
    if (Date.now() - data.issuedAt < MIN_VIEW_MS) return { error: 'Must wait before claiming', valid: false };

    // Validate ad was viewed if required
    if (data.adRequired && !adViewed) return { error: 'You must view the ad before claiming', valid: false };

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

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { coins: { increment: earned }, lastClaimTime: new Date() },
    });

    return { earned, balance: updatedUser.coins, valid: true };
  }
}
