-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "PlanCategory" AS ENUM ('minecraft', 'bot');

-- CreateEnum
CREATE TYPE "DurationType" AS ENUM ('weekly', 'monthly', 'custom', 'days', 'lifetime');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('coin', 'real');

-- CreateEnum
CREATE TYPE "ServerStatus" AS ENUM ('active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'in_progress', 'closed');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "UtrStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('processing', 'completed');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('google', 'discord');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'user',
    "coins" INTEGER NOT NULL DEFAULT 0,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ip_address" TEXT,
    "last_login_ip" TEXT,
    "pterodactyl_user_id" INTEGER,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "last_claim_time" TIMESTAMP(3),
    "oauth_provider" "OAuthProvider",
    "oauth_id" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_token" TEXT,
    "verification_token_expires" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans_coin" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT DEFAULT 'Package',
    "category" "PlanCategory" NOT NULL DEFAULT 'minecraft',
    "ram" DOUBLE PRECISION NOT NULL,
    "cpu" DOUBLE PRECISION NOT NULL,
    "storage" DOUBLE PRECISION NOT NULL,
    "coin_price" INTEGER NOT NULL,
    "initial_price" INTEGER NOT NULL DEFAULT 0,
    "renewal_price" INTEGER NOT NULL DEFAULT 0,
    "duration_type" "DurationType" NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "limited_stock" BOOLEAN NOT NULL DEFAULT false,
    "stock_amount" INTEGER,
    "one_time_purchase" BOOLEAN NOT NULL DEFAULT false,
    "backup_count" INTEGER NOT NULL DEFAULT 0,
    "extra_ports" INTEGER NOT NULL DEFAULT 0,
    "swap" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plans_coin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans_real" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT DEFAULT 'Server',
    "category" "PlanCategory" NOT NULL DEFAULT 'minecraft',
    "ram" DOUBLE PRECISION NOT NULL,
    "cpu" DOUBLE PRECISION NOT NULL,
    "storage" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "duration_type" "DurationType" NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "limited_stock" BOOLEAN NOT NULL DEFAULT false,
    "stock_amount" INTEGER,
    "backup_count" INTEGER NOT NULL DEFAULT 0,
    "extra_ports" INTEGER NOT NULL DEFAULT 0,
    "swap" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plans_real_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servers" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "plan_type" "PlanType" NOT NULL,
    "plan_coin_id" INTEGER,
    "plan_real_id" INTEGER,
    "pterodactyl_server_id" INTEGER,
    "identifier" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "suspended_at" TIMESTAMP(3),
    "grace_expires_at" TIMESTAMP(3),
    "status" "ServerStatus" NOT NULL DEFAULT 'active',
    "location" TEXT NOT NULL DEFAULT '',
    "software" TEXT NOT NULL DEFAULT 'minecraft',
    "category" "PlanCategory" NOT NULL DEFAULT 'minecraft',
    "egg_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "coin_reward" INTEGER NOT NULL,
    "max_uses" INTEGER NOT NULL,
    "per_user_limit" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" SERIAL NOT NULL,
    "coupon_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "ip_address" TEXT NOT NULL,
    "redeemed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "priority" "TicketPriority" NOT NULL DEFAULT 'medium',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" SERIAL NOT NULL,
    "ticket_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utr_submissions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "utr_number" TEXT NOT NULL,
    "screenshot_path" TEXT NOT NULL,
    "status" "UtrStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utr_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_backups" (
    "id" SERIAL NOT NULL,
    "server_id" INTEGER NOT NULL,
    "pterodactyl_backup_uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'backup',
    "is_automatic" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'processing',
    "status_code" INTEGER,
    "response_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" INTEGER,
    "details" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_content" (
    "id" SERIAL NOT NULL,
    "section_name" TEXT NOT NULL,
    "content_json" TEXT NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_plans" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ram" INTEGER NOT NULL DEFAULT 1,
    "cpu" INTEGER NOT NULL DEFAULT 1,
    "storage" INTEGER NOT NULL DEFAULT 10,
    "features" TEXT NOT NULL DEFAULT '[]',
    "popular" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" SERIAL NOT NULL,
    "site_name" TEXT,
    "background_image" TEXT,
    "background_overlay_opacity" DOUBLE PRECISION,
    "favicon_path" TEXT,
    "logo_path" TEXT DEFAULT '',
    "hero_title" TEXT,
    "hero_subtitle" TEXT,
    "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "features" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "icon" TEXT,

    CONSTRAINT "features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coin_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "coins_per_minute" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "coin_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_oauth_provider_oauth_id_idx" ON "users"("oauth_provider", "oauth_id");

-- CreateIndex
CREATE INDEX "servers_status_idx" ON "servers"("status");

-- CreateIndex
CREATE INDEX "servers_expires_at_idx" ON "servers"("expires_at");

-- CreateIndex
CREATE INDEX "servers_user_id_idx" ON "servers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_code_idx" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupon_redemptions_coupon_id_idx" ON "coupon_redemptions"("coupon_id");

-- CreateIndex
CREATE INDEX "coupon_redemptions_user_id_idx" ON "coupon_redemptions"("user_id");

-- CreateIndex
CREATE INDEX "tickets_user_id_idx" ON "tickets"("user_id");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "ticket_messages_ticket_id_idx" ON "ticket_messages"("ticket_id");

-- CreateIndex
CREATE INDEX "utr_submissions_user_id_idx" ON "utr_submissions"("user_id");

-- CreateIndex
CREATE INDEX "utr_submissions_status_idx" ON "utr_submissions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "server_backups_pterodactyl_backup_uuid_key" ON "server_backups"("pterodactyl_backup_uuid");

-- CreateIndex
CREATE INDEX "server_backups_server_id_idx" ON "server_backups"("server_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_user_id_endpoint_key_idx" ON "idempotency_keys"("user_id", "endpoint", "key");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_user_id_endpoint_key_key" ON "idempotency_keys"("user_id", "endpoint", "key");

-- CreateIndex
CREATE INDEX "audit_log_admin_id_idx" ON "audit_log"("admin_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "site_content_section_name_key" ON "site_content"("section_name");

-- CreateIndex
CREATE INDEX "landing_plans_active_idx" ON "landing_plans"("active");

-- AddForeignKey
ALTER TABLE "servers" ADD CONSTRAINT "servers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servers" ADD CONSTRAINT "servers_plan_coin_id_fkey" FOREIGN KEY ("plan_coin_id") REFERENCES "plans_coin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servers" ADD CONSTRAINT "servers_plan_real_id_fkey" FOREIGN KEY ("plan_real_id") REFERENCES "plans_real"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utr_submissions" ADD CONSTRAINT "utr_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_backups" ADD CONSTRAINT "server_backups_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
