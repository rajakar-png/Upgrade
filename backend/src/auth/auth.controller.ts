import {
  Controller, Get, Post, Req, Res, UseGuards, Body, HttpCode, Query, BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RedisService } from '../redis/redis.service';
import { randomBytes } from 'crypto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
    private redis: RedisService,
  ) {}

  // ── Google OAuth ────────────────────────────────────────────────────────────

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const code = await this.issueOAuthCode(req.user.id, req.user.email, req.user.role);
    const frontendUrl = this.config.get<string>('app.frontendUrl');
    res.redirect(`${frontendUrl}/oauth/callback?code=${code}`);
  }

  // ── Discord OAuth ───────────────────────────────────────────────────────────

  @Get('discord')
  @UseGuards(AuthGuard('discord'))
  discordLogin() {}

  @Get('discord/callback')
  @UseGuards(AuthGuard('discord'))
  async discordCallback(@Req() req: any, @Res() res: Response) {
    const code = await this.issueOAuthCode(req.user.id, req.user.email, req.user.role);
    const frontendUrl = this.config.get<string>('app.frontendUrl');
    res.redirect(`${frontendUrl}/oauth/callback?code=${code}`);
  }

  // ── Profile & Password ──────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id);
  }

  @Post('reset-password')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @HttpCode(200)
  async resetPassword(@CurrentUser() user: any, @Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(user.id, dto.currentPassword, dto.newPassword);
  }

  // ── OAuth Code Exchange ──────────────────────────────────────────────────────

  @Post('exchange')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(200)
  async exchangeCode(@Body('code') code: string) {
    if (!code) throw new BadRequestException('Code is required');
    const key = `oauth_code:${code}`;
    const payload = await this.redis.get(key);
    if (!payload) throw new BadRequestException('Invalid or expired code');
    await this.redis.del(key);
    const { userId, email, role } = JSON.parse(payload);
    const token = this.authService.signToken(userId, email, role);
    return { token };
  }

  private async issueOAuthCode(userId: number, email: string, role: string): Promise<string> {
    const code = randomBytes(32).toString('hex');
    await this.redis.set(`oauth_code:${code}`, JSON.stringify({ userId, email, role }), 60);
    return code;
  }
}
