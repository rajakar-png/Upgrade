import { Controller, Get, Post, Delete, Param, Body, UseGuards, ParseIntPipe, HttpCode } from '@nestjs/common';
import { BackupsService } from './backups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('servers/:serverId/backups')
@UseGuards(JwtAuthGuard)
export class BackupsController {
  constructor(private backupsService: BackupsService) {}

  @Get()
  list(@Param('serverId', ParseIntPipe) serverId: number, @CurrentUser() user: any) {
    return this.backupsService.list(serverId, user.id);
  }

  @Post()
  create(
    @Param('serverId', ParseIntPipe) serverId: number,
    @CurrentUser() user: any,
    @Body('name') name?: string,
  ) {
    return this.backupsService.create(serverId, user.id, name);
  }

  @Get(':uuid/download')
  download(@Param('serverId', ParseIntPipe) serverId: number, @Param('uuid') uuid: string, @CurrentUser() user: any) {
    return this.backupsService.getDownloadUrl(serverId, user.id, uuid);
  }

  @Delete(':uuid')
  @HttpCode(200)
  remove(@Param('serverId', ParseIntPipe) serverId: number, @Param('uuid') uuid: string, @CurrentUser() user: any) {
    return this.backupsService.remove(serverId, user.id, uuid);
  }
}
