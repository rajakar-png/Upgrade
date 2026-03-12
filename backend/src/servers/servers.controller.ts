import {
  Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Headers,
  ParseIntPipe, HttpCode,
} from '@nestjs/common';
import { ServersService } from './servers.service';
import { ServerProvisioningService } from './server-provisioning.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PurchaseServerDto } from './dto/server.dto';

@Controller('servers')
@UseGuards(JwtAuthGuard)
export class ServersController {
  constructor(
    private serversService: ServersService,
    private provisioningService: ServerProvisioningService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: any,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    return this.serversService.getUserServers(user.id, page, limit);
  }

  @Get('nodes')
  nodes(@Query('planType') planType?: string, @Query('planId') planId?: string) {
    return this.serversService.getAvailableNodes(planType, planId ? +planId : undefined);
  }

  @Get('eggs')
  eggs(@Query('category') category?: string) {
    return this.serversService.getAvailableEggs(category);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.serversService.getServerById(id, user.id);
  }

  @Post('purchase')
  purchase(
    @CurrentUser() user: any,
    @Body() dto: PurchaseServerDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.provisioningService.purchaseServer(user.id, dto, idempotencyKey);
  }

  @Post(':id/renew')
  @HttpCode(200)
  renew(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.provisioningService.renewServer(id, user.id);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.provisioningService.deleteServer(id, user.id);
  }
}
