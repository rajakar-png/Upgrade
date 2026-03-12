import { Controller, Post, Body, UseGuards, Req, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CouponsService } from './coupons.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IsString, MinLength, MaxLength } from 'class-validator';

class RedeemCouponDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  code: string;
}

@Controller('coupons')
@UseGuards(JwtAuthGuard)
export class CouponsController {
  constructor(private couponsService: CouponsService) {}

  @Post('redeem')
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @HttpCode(200)
  redeem(@CurrentUser() user: any, @Body() dto: RedeemCouponDto, @Req() req: any) {
    const ip = req.ip || req.headers['x-forwarded-for'] || '0.0.0.0';
    return this.couponsService.redeem(dto.code, user.id, ip);
  }
}
