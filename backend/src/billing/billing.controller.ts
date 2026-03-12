import {
  Controller, Get, Post, Body, UseGuards, UploadedFile,
  UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IsNumber, IsString, IsPositive } from 'class-validator';
import { Transform } from 'class-transformer';
import { imageFileFilter, validateImageBuffer } from '../utils/upload.util';
import { readFile } from 'fs/promises';

class SubmitUtrDto {
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  utrNumber: string;
}

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Get('upi')
  upiDetails() {
    return this.billingService.getUpiDetails();
  }

  @Get('submissions')
  submissions(@CurrentUser() user: any) {
    return this.billingService.getUserSubmissions(user.id);
  }

  @Post('utr')
  @UseInterceptors(
    FileInterceptor('screenshot', {
      storage: diskStorage({
        destination: process.env.UPLOAD_DIR || './uploads',
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `utr-${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: imageFileFilter,
    }),
  )
  async submitUtr(
    @CurrentUser() user: any,
    @Body() dto: SubmitUtrDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Screenshot is required');
    await validateImageBuffer(await readFile(file.path));
    return this.billingService.submitUtr(user.id, dto.amount, dto.utrNumber, file.filename);
  }
}
