-- AlterTable
ALTER TABLE "site_settings"
ADD COLUMN "background_image_alt" TEXT,
ADD COLUMN "logo_alt" TEXT,
ADD COLUMN "robots_txt" TEXT;

-- AlterTable
ALTER TABLE "popup_messages"
ADD COLUMN "image_alt" TEXT;

-- CreateTable
CREATE TABLE "seo_pages" (
    "id" SERIAL NOT NULL,
    "page_key" TEXT NOT NULL,
    "page_type" TEXT NOT NULL DEFAULT 'main',
    "route_path" TEXT NOT NULL,
    "slug" TEXT,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "meta_keywords" TEXT,
    "canonical_url" TEXT,
    "og_title" TEXT,
    "og_description" TEXT,
    "og_image" TEXT,
    "twitter_card_title" TEXT,
    "twitter_card_desc" TEXT,
    "twitter_card_image" TEXT,
    "robots_index" BOOLEAN NOT NULL DEFAULT true,
    "robots_follow" BOOLEAN NOT NULL DEFAULT true,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seo_pages_page_key_key" ON "seo_pages"("page_key");

-- CreateIndex
CREATE UNIQUE INDEX "seo_pages_route_path_key" ON "seo_pages"("route_path");

-- CreateIndex
CREATE UNIQUE INDEX "seo_pages_slug_key" ON "seo_pages"("slug");

-- CreateIndex
CREATE INDEX "seo_pages_page_type_idx" ON "seo_pages"("page_type");

-- CreateIndex
CREATE INDEX "seo_pages_is_public_robots_index_idx" ON "seo_pages"("is_public", "robots_index");
