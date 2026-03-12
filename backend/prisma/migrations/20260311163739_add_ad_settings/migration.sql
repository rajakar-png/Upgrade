/*
  Warnings:

  - You are about to drop the column `coins_per_referral` on the `affiliate_settings` table. All the data in the column will be lost.
  - You are about to drop the column `coins_awarded` on the `referrals` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'resolved';

-- DropIndex
DROP INDEX "referrals_referred_id_key";

-- AlterTable
ALTER TABLE "affiliate_settings" DROP COLUMN "coins_per_referral",
ADD COLUMN     "commission_percent" INTEGER NOT NULL DEFAULT 10,
ALTER COLUMN "discord_claim_required" SET DEFAULT false;

-- AlterTable
ALTER TABLE "referrals" DROP COLUMN "coins_awarded",
ADD COLUMN     "commission_earned" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "plan_name" TEXT;

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "discord_bot_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "discord_bot_token" TEXT,
ADD COLUMN     "discord_ping_role_id" TEXT,
ADD COLUMN     "discord_ticket_channel_id" TEXT,
ADD COLUMN     "discord_utr_channel_id" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pterodactyl_password" TEXT;

-- CreateTable
CREATE TABLE "plan_node_allocations" (
    "id" SERIAL NOT NULL,
    "plan_type" "PlanType" NOT NULL,
    "plan_coin_id" INTEGER,
    "plan_real_id" INTEGER,
    "node_id" INTEGER NOT NULL,
    "node_name" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "plan_node_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "ad_provider" TEXT NOT NULL DEFAULT 'none',
    "ad_blocker_detection" BOOLEAN NOT NULL DEFAULT true,
    "require_ad_view" BOOLEAN NOT NULL DEFAULT true,
    "adsense_publisher_id" TEXT,
    "adsense_slot_id" TEXT,
    "adsterra_banner_key" TEXT,
    "adsterra_native_key" TEXT,

    CONSTRAINT "ad_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_node_allocations_plan_type_plan_coin_id_plan_real_id_n_key" ON "plan_node_allocations"("plan_type", "plan_coin_id", "plan_real_id", "node_id");

-- CreateIndex
CREATE INDEX "referrals_referred_id_idx" ON "referrals"("referred_id");

-- AddForeignKey
ALTER TABLE "plan_node_allocations" ADD CONSTRAINT "plan_node_allocations_plan_coin_id_fkey" FOREIGN KEY ("plan_coin_id") REFERENCES "plans_coin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_node_allocations" ADD CONSTRAINT "plan_node_allocations_plan_real_id_fkey" FOREIGN KEY ("plan_real_id") REFERENCES "plans_real"("id") ON DELETE CASCADE ON UPDATE CASCADE;
