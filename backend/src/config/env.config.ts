import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  database: {
    url: process.env.DATABASE_URL!,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  },

  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    },
    callbackUrl: process.env.OAUTH_CALLBACK_URL || 'http://localhost:4000',
  },

  pterodactyl: {
    url: process.env.PTERODACTYL_URL!,
    apiKey: process.env.PTERODACTYL_API_KEY!,
    sftpHost: process.env.PTERODACTYL_SFTP_HOST || '',
    sftpPort: parseInt(process.env.PTERODACTYL_SFTP_PORT || '0', 10) || 0,
    defaultEgg: parseInt(process.env.PTERODACTYL_DEFAULT_EGG || '1', 10),
    defaultDockerImage: process.env.PTERODACTYL_DEFAULT_DOCKER_IMAGE || '',
    defaultStartup: process.env.PTERODACTYL_DEFAULT_STARTUP || '',
    defaultEnv: JSON.parse(process.env.PTERODACTYL_DEFAULT_ENV || '{}'),
  },

  uploads: {
    dir: process.env.UPLOAD_DIR || './uploads',
  },

  rateLimit: {
    window: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '200', 10),
  },

  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    supportWebhookUrl: process.env.DISCORD_SUPPORT_WEBHOOK_URL,
  },

  upi: {
    id: process.env.UPI_ID,
    name: process.env.UPI_NAME,
  },

  cron: {
    backupConcurrency: parseInt(process.env.BACKUP_CRON_CONCURRENCY || '3', 10),
    auditLogRetentionDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90', 10),
  },

  cloudflare: {
    apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
    zoneId: process.env.CLOUDFLARE_ZONE_ID || '',
    domain: process.env.CLOUDFLARE_DOMAIN || 'astranodes.cloud',
  },
}));
