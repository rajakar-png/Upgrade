import { Controller, Get, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CoinsService } from './coins.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IsString, IsBoolean, IsOptional, Length } from 'class-validator';

class ClaimDto {
  @IsString()
  @Length(64, 64)
  earnToken: string;

  @IsBoolean()
  @IsOptional()
  adViewed?: boolean;
}

@Controller('coins')
@UseGuards(JwtAuthGuard)
export class CoinsController {
  constructor(private coinsService: CoinsService) {}

  @Get('balance')
  balance(@CurrentUser() user: any) {
    return this.coinsService.getBalance(user.id);
  }

  @Get('ad-config')
  adConfig() {
    return this.coinsService.getAdConfig();
  }

  @Post('session')
  @HttpCode(200)
  async session(@CurrentUser() user: any) {
    const result = await this.coinsService.issueEarnToken(user.id, user.flagged);
    return result;
  }

  @Post('claim')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(200)
  async claim(@CurrentUser() user: any, @Body() dto: ClaimDto) {
    const result = await this.coinsService.claimCoins(user.id, dto.earnToken, user.flagged, dto.adViewed);
    if (!result.valid) {
      if ('waitSeconds' in result) {
        return { error: result.error, waitSeconds: result.waitSeconds };
      }
      return { error: result.error };
    }
    return { earned: result.earned, balance: result.balance };
  }
}
