import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PterodactylService } from '../pterodactyl/pterodactyl.service';
import { OAuthProvider } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

interface OAuthUserDto {
  email: string;
  oauthProvider: 'google' | 'discord';
  oauthId: string;
  firstName?: string;
  lastName?: string;
  ipAddress: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private pterodactyl: PterodactylService,
  ) {}

  signToken(userId: number, email: string, role: string): string {
    return this.jwt.sign({ sub: userId, email, role });
  }

  async findOrCreateOAuthUser(dto: OAuthUserDto) {
    const provider = dto.oauthProvider as OAuthProvider;

    // Try exact OAuth match first (prevents cross-provider account takeover)
    let user = await this.prisma.user.findFirst({
      where: { oauthProvider: provider, oauthId: dto.oauthId },
    });

    // Fall back to email match only if no OAuth provider is set
    if (!user) {
      user = await this.prisma.user.findFirst({
        where: { email: dto.email, oauthProvider: null },
      });
    }

    if (user) {
      // Attach OAuth credentials if missing
      if (!user.oauthProvider || !user.oauthId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { oauthProvider: provider, oauthId: dto.oauthId },
        });
      }
      // Update last login IP
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginIp: dto.ipAddress },
      });
      return user;
    }

    // Create Pterodactyl user for new account
    const username =
      dto.email.split('@')[0].replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20) ||
      `user${Date.now()}`;
    const pteroPassword = randomBytes(24).toString('base64url');
    let pterodactylUserId: number | null = null;

    try {
      pterodactylUserId = await this.pterodactyl.getUserByEmail(dto.email);
      if (!pterodactylUserId) {
        pterodactylUserId = await this.pterodactyl.createUser({
          email: dto.email,
          username,
          firstName: dto.firstName || username,
          lastName: dto.lastName || 'User',
          password: pteroPassword,
        });
      }
    } catch (err) {
      // Non-fatal — provisioned lazily on first server purchase
      console.warn('[Auth] Pterodactyl user creation failed (non-fatal):', err.message);
    }

    return this.prisma.user.create({
      data: {
        email: dto.email,
        oauthProvider: provider,
        oauthId: dto.oauthId,
        pterodactylUserId,
        ipAddress: dto.ipAddress,
        lastLoginIp: dto.ipAddress,
        emailVerified: true,
      },
    });
  }

  async resetPassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('No password set on this account');
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    if (currentPassword === newPassword) {
      throw new ConflictException('New password must differ from current');
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });
    return { message: 'Password updated' };
  }

  async getProfile(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        coins: true,
        balance: true,
        oauthProvider: true,
        emailVerified: true,
        createdAt: true,
      },
    });
  }
}
