/*
  Warnings:

  - A unique constraint covering the columns `[subdomain]` on the table `servers` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "servers" ADD COLUMN     "subdomain" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "servers_subdomain_key" ON "servers"("subdomain");
