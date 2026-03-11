import { IsString, IsEnum, IsInt, IsPositive, IsOptional, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class PurchaseServerDto {
  @IsEnum(['coin', 'real'])
  planType: 'coin' | 'real';

  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @IsPositive()
  planId: number;

  @IsString()
  @MinLength(3)
  @MaxLength(60)
  serverName: string;

  @IsEnum(['minecraft', 'bot'])
  @IsOptional()
  category?: 'minecraft' | 'bot' = 'minecraft';

  @IsString()
  @MaxLength(80)
  @IsOptional()
  location?: string;

  @Transform(({ value }) => value ? parseInt(value, 10) : undefined)
  @IsInt()
  @IsPositive()
  @IsOptional()
  nodeId?: number;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  software?: string = 'minecraft';

  @Transform(({ value }) => value ? parseInt(value, 10) : undefined)
  @IsInt()
  @IsPositive()
  @IsOptional()
  eggId?: number;
}

export class RenewServerDto {
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @IsPositive()
  serverId: number;
}
