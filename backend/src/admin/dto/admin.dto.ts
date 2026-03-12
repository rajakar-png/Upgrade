import {
  IsString, IsNumber, IsBoolean, IsOptional, IsEnum, IsInt,
  IsPositive, Min, Max, MaxLength, MinLength, IsDateString,
  IsArray, ValidateNested, ArrayMinSize,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// ── Users ─────────────────────────────────────────────────────────────────────

export class UpdateUserDto {
  @IsOptional() @IsInt() @Min(0) coins?: number;
  @IsOptional() @IsNumber() @Min(0) balance?: number;
  @IsOptional() @IsEnum(['user', 'admin']) role?: string;
  @IsOptional() @IsBoolean() flagged?: boolean;
}

// ── Plans (Coin) ──────────────────────────────────────────────────────────────

export class CreateCoinPlanDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(50) icon?: string;
  @IsOptional() @IsEnum(['minecraft', 'bot']) category?: string;
  @IsNumber() @IsPositive() ram: number;
  @IsNumber() @IsPositive() cpu: number;
  @IsNumber() @IsPositive() storage: number;
  @IsInt() @Min(0) coinPrice: number;
  @IsOptional() @IsInt() @Min(0) initialPrice?: number;
  @IsOptional() @IsInt() @Min(0) renewalPrice?: number;
  @IsEnum(['weekly', 'monthly', 'custom', 'days', 'lifetime']) durationType: string;
  @IsInt() @Min(0) durationDays: number;
  @IsOptional() @IsBoolean() limitedStock?: boolean;
  @IsOptional() @IsInt() @Min(0) stockAmount?: number;
  @IsOptional() @IsBoolean() oneTimePurchase?: boolean;
  @IsOptional() @IsInt() @Min(0) backupCount?: number;
  @IsOptional() @IsInt() @Min(0) extraPorts?: number;
  @IsOptional() @IsInt() @Min(0) swap?: number;
}

export class UpdateCoinPlanDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(50) icon?: string;
  @IsOptional() @IsEnum(['minecraft', 'bot']) category?: string;
  @IsOptional() @IsNumber() @IsPositive() ram?: number;
  @IsOptional() @IsNumber() @IsPositive() cpu?: number;
  @IsOptional() @IsNumber() @IsPositive() storage?: number;
  @IsOptional() @IsInt() @Min(0) coinPrice?: number;
  @IsOptional() @IsInt() @Min(0) initialPrice?: number;
  @IsOptional() @IsInt() @Min(0) renewalPrice?: number;
  @IsOptional() @IsEnum(['weekly', 'monthly', 'custom', 'days', 'lifetime']) durationType?: string;
  @IsOptional() @IsInt() @Min(0) durationDays?: number;
  @IsOptional() @IsBoolean() limitedStock?: boolean;
  @IsOptional() @IsInt() @Min(0) stockAmount?: number;
  @IsOptional() @IsBoolean() oneTimePurchase?: boolean;
  @IsOptional() @IsInt() @Min(0) backupCount?: number;
  @IsOptional() @IsInt() @Min(0) extraPorts?: number;
  @IsOptional() @IsInt() @Min(0) swap?: number;
}

// ── Plans (Real) ──────────────────────────────────────────────────────────────

export class CreateRealPlanDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(50) icon?: string;
  @IsOptional() @IsEnum(['minecraft', 'bot']) category?: string;
  @IsNumber() @IsPositive() ram: number;
  @IsNumber() @IsPositive() cpu: number;
  @IsNumber() @IsPositive() storage: number;
  @IsNumber() @IsPositive() price: number;
  @IsEnum(['weekly', 'monthly', 'custom', 'days', 'lifetime']) durationType: string;
  @IsInt() @Min(0) durationDays: number;
  @IsOptional() @IsBoolean() limitedStock?: boolean;
  @IsOptional() @IsInt() @Min(0) stockAmount?: number;
  @IsOptional() @IsInt() @Min(0) backupCount?: number;
  @IsOptional() @IsInt() @Min(0) extraPorts?: number;
  @IsOptional() @IsInt() @Min(0) swap?: number;
}

export class UpdateRealPlanDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(50) icon?: string;
  @IsOptional() @IsEnum(['minecraft', 'bot']) category?: string;
  @IsOptional() @IsNumber() @IsPositive() ram?: number;
  @IsOptional() @IsNumber() @IsPositive() cpu?: number;
  @IsOptional() @IsNumber() @IsPositive() storage?: number;
  @IsOptional() @IsNumber() @IsPositive() price?: number;
  @IsOptional() @IsEnum(['weekly', 'monthly', 'custom', 'days', 'lifetime']) durationType?: string;
  @IsOptional() @IsInt() @Min(0) durationDays?: number;
  @IsOptional() @IsBoolean() limitedStock?: boolean;
  @IsOptional() @IsInt() @Min(0) stockAmount?: number;
  @IsOptional() @IsInt() @Min(0) backupCount?: number;
  @IsOptional() @IsInt() @Min(0) extraPorts?: number;
  @IsOptional() @IsInt() @Min(0) swap?: number;
}

// ── Coupons ───────────────────────────────────────────────────────────────────

export class CreateCouponDto {
  @IsString() @MinLength(3) @MaxLength(64) code: string;
  @IsInt() @IsPositive() coinReward: number;
  @IsInt() @IsPositive() maxUses: number;
  @IsInt() @IsPositive() perUserLimit: number;
  @IsDateString() expiresAt: string;
}

export class UpdateCouponDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(64) code?: string;
  @IsOptional() @IsInt() @IsPositive() coinReward?: number;
  @IsOptional() @IsInt() @IsPositive() maxUses?: number;
  @IsOptional() @IsInt() @IsPositive() perUserLimit?: number;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

// ── Ad Settings ───────────────────────────────────────────────────────────────

export class UpdateAdSettingsDto {
  @IsOptional() @IsEnum(['none', 'adsense', 'adsterra']) adProvider?: string;
  @IsOptional() @IsBoolean() @Transform(({ value }) => value === true || value === 'true') adBlockerDetection?: boolean;
  @IsOptional() @IsBoolean() @Transform(({ value }) => value === true || value === 'true') requireAdView?: boolean;
  @IsOptional() @IsString() @MaxLength(200) adsensePublisherId?: string;
  @IsOptional() @IsString() @MaxLength(200) adsenseSlotId?: string;
  @IsOptional() @IsString() @MaxLength(200) adsterraBannerKey?: string;
  @IsOptional() @IsString() @MaxLength(200) adsterraNativeKey?: string;
}

// ── Popup Messages ────────────────────────────────────────────────────────────

export class CreatePopupDto {
  @IsString() @MinLength(1) @MaxLength(200) title: string;
  @IsString() @MinLength(1) message: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsBoolean() @Transform(({ value }) => value === true || value === 'true') enabled?: boolean;
  @IsOptional() @IsBoolean() @Transform(({ value }) => value === true || value === 'true') showOnce?: boolean;
  @IsOptional() @Transform(({ value }) => parseInt(value)) @IsInt() @Min(0) sortOrder?: number;
}

export class UpdatePopupDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MinLength(1) message?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsBoolean() @Transform(({ value }) => value === true || value === 'true') enabled?: boolean;
  @IsOptional() @IsBoolean() @Transform(({ value }) => value === true || value === 'true') showOnce?: boolean;
  @IsOptional() @Transform(({ value }) => parseInt(value)) @IsInt() @Min(0) sortOrder?: number;
}

// ── Site Settings ─────────────────────────────────────────────────────────────

export class UpdateSiteSettingsDto {
  @IsOptional() @IsString() @MaxLength(200) siteName?: string;
  @IsOptional() @IsString() @MaxLength(500) heroTitle?: string;
  @IsOptional() @IsString() @MaxLength(1000) heroSubtitle?: string;
  @IsOptional() @IsString() @MaxLength(500) faviconPath?: string;
  @IsOptional() @IsString() @MaxLength(500) logoPath?: string;
  @IsOptional() @IsString() @MaxLength(500) discordInviteUrl?: string;
  @IsOptional() @IsBoolean() @Transform(({ value }) => value === true || value === 'true') maintenanceMode?: boolean;
  @IsOptional() @IsBoolean() @Transform(({ value }) => value === true || value === 'true') discordPopupEnabled?: boolean;
  @IsOptional() @IsBoolean() @Transform(({ value }) => value === true || value === 'true') discordBotEnabled?: boolean;
  @IsOptional() @IsString() @MaxLength(200) discordBotToken?: string;
  @IsOptional() @IsString() @MaxLength(100) discordUtrChannelId?: string;
  @IsOptional() @IsString() @MaxLength(100) discordTicketChannelId?: string;
  @IsOptional() @IsString() @MaxLength(100) discordPingRoleId?: string;
}

// ── Tickets ───────────────────────────────────────────────────────────────────

export class AdminReplyTicketDto {
  @IsString() @MinLength(1) message: string;
}

export class UpdateTicketStatusDto {
  @IsEnum(['open', 'in_progress', 'resolved', 'closed']) status: string;
}
