import {
  Controller, Get, Post, Put, Patch, Delete, Param, Body, Query,
  UseGuards, ParseIntPipe, HttpCode, Req, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AdminService } from './admin.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  UpdateUserDto, CreateCoinPlanDto, UpdateCoinPlanDto, CreateRealPlanDto, UpdateRealPlanDto,
  CreateCouponDto, UpdateCouponDto, UpdateAdSettingsDto, CreatePopupDto, UpdatePopupDto,
  UpdateSiteSettingsDto, AdminReplyTicketDto, UpdateTicketStatusDto,
} from './dto/admin.dto';
import { imageFileFilter } from '../utils/upload.util';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private dashboardService: AdminDashboardService,
  ) {}

  // ── Stats ───────────────────────────────────────────────────────────────────

  @Get('stats')
  stats() {
    return this.dashboardService.getDashboardStats();
  }

  // ── Users ───────────────────────────────────────────────────────────────────

  @Get('users')
  users(@Query('page') page = 1, @Query('limit') limit = 30, @Query('search') search?: string) {
    return this.adminService.getUsers(+page, +limit, search);
  }

  @Patch('users/:id')
  updateUser(@Param('id', ParseIntPipe) id: number, @Body() data: UpdateUserDto) {
    return this.adminService.updateUser(id, data);
  }

  @Delete('users/:id')
  deleteUser(@Param('id', ParseIntPipe) id: number, @CurrentUser() admin: any, @Req() req: any) {
    this.dashboardService.logAction(admin.id, 'user_deleted', 'user', id, undefined, req.ip);
    return this.adminService.deleteUser(id);
  }

  @Get('users/:id/servers')
  getUserServers(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getUserServers(id);
  }

  // ── Admin Servers ───────────────────────────────────────────────────────────

  @Get('servers')
  servers(@Query('page') page = 1, @Query('limit') limit = 30, @Query('search') search?: string) {
    return this.adminService.getAdminServers(+page, +limit, search);
  }

  @Get('servers/sync')
  syncServers() {
    return this.adminService.syncServersWithPterodactyl();
  }

  @Get('servers/:id')
  getServer(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.adminGetServer(id);
  }

  @Post('servers/:id/suspend')
  @HttpCode(200)
  suspendServer(@Param('id', ParseIntPipe) id: number, @CurrentUser() admin: any, @Req() req: any) {
    this.dashboardService.logAction(admin.id, 'server_suspended', 'server', id, undefined, req.ip);
    return this.adminService.adminSuspendServer(id);
  }

  @Post('servers/:id/unsuspend')
  @HttpCode(200)
  unsuspendServer(@Param('id', ParseIntPipe) id: number, @CurrentUser() admin: any, @Req() req: any) {
    this.dashboardService.logAction(admin.id, 'server_unsuspended', 'server', id, undefined, req.ip);
    return this.adminService.adminUnsuspendServer(id);
  }

  @Delete('servers/:id')
  deleteServer(@Param('id', ParseIntPipe) id: number, @CurrentUser() admin: any, @Req() req: any) {
    this.dashboardService.logAction(admin.id, 'server_deleted', 'server', id, undefined, req.ip);
    return this.adminService.adminDeleteServer(id);
  }

  // ── Node Allocations ────────────────────────────────────────────────────────

  @Get('node-allocations')
  getAllNodeAllocations() { return this.adminService.getAllNodeAllocations(); }

  @Get('node-allocations/:planType/:planId')
  getNodeAllocations(@Param('planType') planType: string, @Param('planId', ParseIntPipe) planId: number) {
    return this.adminService.getNodeAllocations(planType, planId);
  }

  @Put('node-allocations/:planType/:planId')
  setNodeAllocations(
    @Param('planType') planType: string,
    @Param('planId', ParseIntPipe) planId: number,
    @Body('nodes') nodes: { nodeId: number; nodeName?: string }[],
  ) {
    return this.adminService.setNodeAllocations(planType, planId, nodes);
  }

  // ── Plans ───────────────────────────────────────────────────────────────────

  @Post('plans/coin')
  createCoinPlan(@Body() data: CreateCoinPlanDto) { return this.adminService.createCoinPlan(data); }

  @Put('plans/coin/:id')
  updateCoinPlan(@Param('id', ParseIntPipe) id: number, @Body() data: UpdateCoinPlanDto) {
    return this.adminService.updateCoinPlan(id, data);
  }

  @Delete('plans/coin/:id')
  deleteCoinPlan(@Param('id', ParseIntPipe) id: number) { return this.adminService.deleteCoinPlan(id); }

  @Post('plans/real')
  createRealPlan(@Body() data: CreateRealPlanDto) { return this.adminService.createRealPlan(data); }

  @Put('plans/real/:id')
  updateRealPlan(@Param('id', ParseIntPipe) id: number, @Body() data: UpdateRealPlanDto) {
    return this.adminService.updateRealPlan(id, data);
  }

  @Delete('plans/real/:id')
  deleteRealPlan(@Param('id', ParseIntPipe) id: number) { return this.adminService.deleteRealPlan(id); }

  // ── Coupons ─────────────────────────────────────────────────────────────────

  @Get('coupons')
  coupons() { return this.adminService.getCoupons(); }

  @Post('coupons')
  createCoupon(@Body() data: CreateCouponDto) { return this.adminService.createCoupon(data); }

  @Put('coupons/:id')
  updateCoupon(@Param('id', ParseIntPipe) id: number, @Body() data: UpdateCouponDto) {
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
    @Body() dto: AdminReplyTicketDto,
  ) {
    return this.adminService.replyTicket(id, user.id, dto.message);
  }

  @Patch('tickets/:id/close')
  @HttpCode(200)
  closeTicket(@Param('id', ParseIntPipe) id: number) { return this.adminService.closeTicket(id); }

  @Patch('tickets/:id/status')
  @HttpCode(200)
  updateTicketStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTicketStatusDto) {
    return this.adminService.updateTicketStatus(id, dto.status);
  }

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
    this.dashboardService.logAction(user.id, 'utr_approved', 'utr', id, `balance=${balance}`, req.ip);
    return this.adminService.processUtr(id, true, balance);
  }

  @Post('utr/:id/reject')
  @HttpCode(200)
  rejectUtr(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any, @Req() req: any) {
    this.dashboardService.logAction(user.id, 'utr_rejected', 'utr', id, undefined, req.ip);
    return this.adminService.processUtr(id, false);
  }

  // ── Audit Log ───────────────────────────────────────────────────────────────

  @Get('audit')
  audit(@Query('page') page = 1, @Query('limit') limit = 50) {
    return this.dashboardService.getAuditLog(+page, +limit);
  }

  // ── Coin Settings ───────────────────────────────────────────────────────────

  @Get('settings/coins')
  getCoinSettings() { return this.adminService.getCoinSettings(); }

  @Put('settings/coins')
  updateCoinSettings(@Body('coinsPerMinute', ParseIntPipe) coinsPerMinute: number) {
    return this.adminService.updateCoinSettings(coinsPerMinute);
  }

  // ── Ad Settings ─────────────────────────────────────────────────────────────

  @Get('ad-settings')
  getAdSettings() { return this.adminService.getAdSettings(); }

  @Put('ad-settings')
  updateAdSettings(@Body() data: UpdateAdSettingsDto) {
    return this.adminService.updateAdSettings(data);
  }

  // ── Popup Messages ──────────────────────────────────────────────────────────

  @Get('popups')
  getPopups() { return this.adminService.getPopups(); }

  @Post('popups')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: process.env.UPLOAD_DIR || './uploads',
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `popup-${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: imageFileFilter,
    }),
  )
  createPopup(@Body() data: CreatePopupDto, @UploadedFile() file?: Express.Multer.File) {
    if (file) data.imageUrl = `/uploads/${file.filename}`;
    return this.adminService.createPopup(data);
  }

  @Put('popups/:id')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: process.env.UPLOAD_DIR || './uploads',
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `popup-${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: imageFileFilter,
    }),
  )
  updatePopup(@Param('id', ParseIntPipe) id: number, @Body() data: UpdatePopupDto, @UploadedFile() file?: Express.Multer.File) {
    if (file) data.imageUrl = `/uploads/${file.filename}`;
    return this.adminService.updatePopup(id, data);
  }

  @Delete('popups/:id')
  deletePopup(@Param('id', ParseIntPipe) id: number) { return this.adminService.deletePopup(id); }

  // ── Site Settings (with image upload) ───────────────────────────────────────

  @Put('site/settings')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: process.env.UPLOAD_DIR || './uploads',
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `site-${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: imageFileFilter,
    }),
  )
  updateSiteSettings(@Body() data: UpdateSiteSettingsDto, @UploadedFile() file?: Express.Multer.File) {
    return this.adminService.updateSiteSettings(data, file?.filename);
  }
}
