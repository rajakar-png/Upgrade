import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { SiteService } from './site.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('site')
export class SiteController {
  constructor(private siteService: SiteService) {}

  // ── Public endpoints ────────────────────────────────────────────────────────

  @Get('frontpage')
  getAllSections() { return this.siteService.getAllSections(); }

  @Get('frontpage/:section')
  getSection(@Param('section') section: string) { return this.siteService.getSection(section); }

  @Get('settings')
  getSettings() { return this.siteService.getSettings(); }

  @Get('landing-plans')
  getLandingPlans() { return this.siteService.getLandingPlans(); }

  @Get('features')
  getFeatures() { return this.siteService.getFeatures(); }

  // ── Admin endpoints ─────────────────────────────────────────────────────────

  @Put('admin/frontpage/:section')
  @UseGuards(JwtAuthGuard, AdminGuard)
  updateSection(@Param('section') section: string, @Body() data: any) {
    return this.siteService.upsertSection(section, data);
  }

  @Put('admin/settings')
  @UseGuards(JwtAuthGuard, AdminGuard)
  updateSettings(@Body() data: any) { return this.siteService.updateSettings(data); }
}
