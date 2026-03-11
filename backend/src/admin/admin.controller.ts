import {
  Controller, Get, Post, Put, Patch, Delete, Param, Body, Query,
  UseGuards, ParseIntPipe, HttpCode, Req,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ── Stats ───────────────────────────────────────────────────────────────────

  @Get('stats')
  stats() {
    return this.adminService.getDashboardStats();
  }

  // ── Users ───────────────────────────────────────────────────────────────────

  @Get('users')
  users(@Query('page') page = 1, @Query('limit') limit = 20, @Query('search') search?: string) {
    return this.adminService.getUsers(+page, +limit, search);
  }

  @Patch('users/:id')
  updateUser(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
    return this.adminService.updateUser(id, data);
  }

  // ── Plans ───────────────────────────────────────────────────────────────────

  @Post('plans/coin')
  createCoinPlan(@Body() data: any) { return this.adminService.createCoinPlan(data); }

  @Put('plans/coin/:id')
  updateCoinPlan(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
    return this.adminService.updateCoinPlan(id, data);
  }

  @Delete('plans/coin/:id')
  deleteCoinPlan(@Param('id', ParseIntPipe) id: number) { return this.adminService.deleteCoinPlan(id); }

  @Post('plans/real')
  createRealPlan(@Body() data: any) { return this.adminService.createRealPlan(data); }

  @Put('plans/real/:id')
  updateRealPlan(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
    return this.adminService.updateRealPlan(id, data);
  }

  @Delete('plans/real/:id')
  deleteRealPlan(@Param('id', ParseIntPipe) id: number) { return this.adminService.deleteRealPlan(id); }

  // ── Coupons ─────────────────────────────────────────────────────────────────

  @Get('coupons')
  coupons() { return this.adminService.getCoupons(); }

  @Post('coupons')
  createCoupon(@Body() data: any) { return this.adminService.createCoupon(data); }

  @Put('coupons/:id')
  updateCoupon(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
    return this.adminService.updateCoupon(id, data);
  }

  @Delete('coupons/:id')
  deleteCoupon(@Param('id', ParseIntPipe) id: number) { return this.adminService.deleteCoupon(id); }

  // ── Tickets ─────────────────────────────────────────────────────────────────

  @Get('tickets')
  tickets(@Query('status') status?: string, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.adminService.getTickets(status, +page, +limit);
  }

  @Get('tickets/:id')
  ticket(@Param('id', ParseIntPipe) id: number) { return this.adminService.getTicket(id); }

  @Post('tickets/:id/reply')
  @HttpCode(200)
  replyTicket(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @Body('message') message: string,
  ) {
    return this.adminService.replyTicket(id, user.id, message);
  }

  @Patch('tickets/:id/close')
  @HttpCode(200)
  closeTicket(@Param('id', ParseIntPipe) id: number) { return this.adminService.closeTicket(id); }

  // ── UTR ─────────────────────────────────────────────────────────────────────

  @Get('utr')
  utr(@Query('status') status?: string) { return this.adminService.getUtrSubmissions(status); }

  @Post('utr/:id/approve')
  @HttpCode(200)
  approveUtr(
    @Param('id', ParseIntPipe) id: number,
    @Body('balance') balance: number,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    this.adminService.logAction(user.id, 'utr_approved', 'utr', id, `balance=${balance}`, req.ip);
    return this.adminService.processUtr(id, true, balance);
  }

  @Post('utr/:id/reject')
  @HttpCode(200)
  rejectUtr(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any, @Req() req: any) {
    this.adminService.logAction(user.id, 'utr_rejected', 'utr', id, undefined, req.ip);
    return this.adminService.processUtr(id, false);
  }

  // ── Audit Log ───────────────────────────────────────────────────────────────

  @Get('audit')
  audit(@Query('page') page = 1, @Query('limit') limit = 50) {
    return this.adminService.getAuditLog(+page, +limit);
  }

  // ── Coin Settings ───────────────────────────────────────────────────────────

  @Get('settings/coins')
  getCoinSettings() { return this.adminService.getCoinSettings(); }

  @Put('settings/coins')
  updateCoinSettings(@Body('coinsPerMinute', ParseIntPipe) coinsPerMinute: number) {
    return this.adminService.updateCoinSettings(coinsPerMinute);
  }
}
