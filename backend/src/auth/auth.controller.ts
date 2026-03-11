import {
  Controller, Get, Post, Req, Res, UseGuards, Body, HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  // ── Google OAuth ────────────────────────────────────────────────────────────

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const token = this.authService.signToken(req.user.id, req.user.email, req.user.role);
    const frontendUrl = this.config.get<string>('app.frontendUrl');
    res.redirect(`${frontendUrl}/oauth/callback?token=${token}`);
  }

  // ── Discord OAuth ───────────────────────────────────────────────────────────

  @Get('discord')
  @UseGuards(AuthGuard('discord'))
  discordLogin() {}

  @Get('discord/callback')
  @UseGuards(AuthGuard('discord'))
  async discordCallback(@Req() req: any, @Res() res: Response) {
    const token = this.authService.signToken(req.user.id, req.user.email, req.user.role);
    const frontendUrl = this.config.get<string>('app.frontendUrl');
    res.redirect(`${frontendUrl}/oauth/callback?token=${token}`);
  }

  // ── Profile & Password ──────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id);
  }

  @Post('reset-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async resetPassword(@CurrentUser() user: any, @Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
