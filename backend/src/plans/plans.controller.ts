import { Controller, Get, Query } from '@nestjs/common';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private plansService: PlansService) {}

  @Get()
  getAll(@Query('category') category?: string) {
    return this.plansService.getAllPlans();
  }

  @Get('coin')
  getCoin(@Query('category') category?: string) {
    return this.plansService.getCoinPlans(category);
  }

  @Get('real')
  getReal(@Query('category') category?: string) {
    return this.plansService.getRealPlans(category);
  }
}
