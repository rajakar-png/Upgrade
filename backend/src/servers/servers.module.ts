import { Module } from '@nestjs/common';
import { ServersController } from './servers.controller';
import { ServersService } from './servers.service';
import { ServerManageController } from './server-manage.controller';
import { ServerManageService } from './server-manage.service';

@Module({
  controllers: [ServersController, ServerManageController],
  providers: [ServersService, ServerManageService],
  exports: [ServersService],
})
export class ServersModule {}
