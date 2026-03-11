import { Global, Module } from '@nestjs/common';
import { PterodactylService } from './pterodactyl.service';

@Global()
@Module({
  providers: [PterodactylService],
  exports: [PterodactylService],
})
export class PterodactylModule {}
