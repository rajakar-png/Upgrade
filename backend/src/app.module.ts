import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PlansModule } from './plans/plans.module';
import { ServersModule } from './servers/servers.module';
import { CoinsModule } from './coins/coins.module';
import { CouponsModule } from './coupons/coupons.module';
import { TicketsModule } from './tickets/tickets.module';
import { BillingModule } from './billing/billing.module';
import { AdminModule } from './admin/admin.module';
import { SiteModule } from './site/site.module';
import { BackupsModule } from './backups/backups.module';
import { PterodactylModule } from './pterodactyl/pterodactyl.module';
import { CronModule } from './cron/cron.module';
import { HealthModule } from './health/health.module';
import { DnsModule } from './dns/dns.module';
import envConfig from './config/env.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envConfig],
      envFilePath: ['.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    PterodactylModule,
    DnsModule,
    AuthModule,
    UsersModule,
    PlansModule,
    ServersModule,
    CoinsModule,
    CouponsModule,
    TicketsModule,
    BillingModule,
    AdminModule,
    SiteModule,
    BackupsModule,
    CronModule,
    HealthModule,
  ],
})
export class AppModule {}
