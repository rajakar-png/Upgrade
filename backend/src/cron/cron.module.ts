import { Module } from '@nestjs/common';
import { ExpiryCronService } from './cron.service';

@Module({
  providers: [ExpiryCronService],
})
export class CronModule {}
