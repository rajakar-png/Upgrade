import { Module, Global } from '@nestjs/common';
import { DnsService } from './dns.service';

@Global()
@Module({
  providers: [DnsService],
  exports: [DnsService],
})
export class DnsModule {}
