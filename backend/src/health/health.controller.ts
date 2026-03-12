import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller()
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Get('health')
  async health() {
    const checks: Record<string, string> = {};
    let overall = 'ok';

    // Database check
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
      overall = 'degraded';
    }

    // Redis check
    try {
      const client = this.redis.getClient();
      const pong = await client.ping();
      checks.redis = pong === 'PONG' ? 'ok' : 'error';
    } catch {
      checks.redis = 'error';
      overall = 'degraded';
    }

    return {
      status: overall,
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  @Get('ready')
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ready', db: 'connected' };
  }
}
