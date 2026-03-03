-- Add software column to servers table
-- This migration adds support for Minecraft server software selection (PaperMC, Fabric, Forge)

ALTER TABLE servers ADD COLUMN software TEXT NOT NULL DEFAULT 'papermc' CHECK (software IN ('papermc', 'fabric', 'forge'));
