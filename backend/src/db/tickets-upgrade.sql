-- =====================================================
-- UPGRADE EXISTING TICKET SYSTEM WITH ADVANCED FEATURES
-- =====================================================

-- Add priority column to tickets table
ALTER TABLE tickets ADD COLUMN priority TEXT DEFAULT 'Medium' CHECK(priority IN ('Low', 'Medium', 'High'));

-- Add username and email for denormalized access (using email for both since users table has no username)
ALTER TABLE tickets ADD COLUMN username TEXT;
ALTER TABLE tickets ADD COLUMN email TEXT;

-- Add image support to ticket messages
ALTER TABLE ticket_messages ADD COLUMN image TEXT;

-- Update existing tickets with user info (backfill) - using email for both username and email
UPDATE tickets 
SET username = (SELECT email FROM users WHERE users.id = tickets.user_id),
    email = (SELECT email FROM users WHERE users.id = tickets.user_id)
WHERE username IS NULL;

-- Create index on priority for filtering
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
