import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { validateEnv } from './config/validate-env';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import helmet from 'helmet';
import * as compression from 'compression';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(compression());

  // Serve uploaded files with security headers
  const uploadsDir = process.env.UPLOAD_DIR || './uploads';
  app.use('/uploads', (_req, res, next) => {
    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  }, express.static(join(process.cwd(), uploadsDir)));

  // CORS
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((u) => u.trim());

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (origin.endsWith('.app.github.dev')) return cb(null, true);
      if (process.env.NODE_ENV !== 'production') return cb(null, true);
      cb(allowedOrigins.includes(origin) ? null : new Error('CORS not allowed'), allowedOrigins.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  });

  // Global validation pipe — strips unknown keys, transforms types
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Global exception filter — sanitize error responses
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`[AstraNodes] ✓ API listening on http://0.0.0.0:${port}/api`);
}

bootstrap();
