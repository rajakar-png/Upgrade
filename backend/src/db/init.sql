CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  coins INTEGER NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  ip_address TEXT,
  last_login_ip TEXT,
  pterodactyl_user_id INTEGER,
  flagged INTEGER NOT NULL DEFAULT 0,
  last_claim_time TEXT,
  oauth_provider TEXT,
  oauth_id TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  verification_token TEXT,
  verification_token_expires TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plans_coin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'Package',
  ram INTEGER NOT NULL,
  cpu INTEGER NOT NULL,
  storage INTEGER NOT NULL,
  coin_price INTEGER NOT NULL,
  duration_type TEXT NOT NULL CHECK (duration_type IN ('weekly', 'monthly', 'custom', 'days', 'lifetime')),
  duration_days INTEGER NOT NULL,
  limited_stock INTEGER NOT NULL DEFAULT 0,
  stock_amount INTEGER,
  one_time_purchase INTEGER NOT NULL DEFAULT 0,
  backup_count INTEGER NOT NULL DEFAULT 0,
  extra_ports INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plans_real (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'Server',
  ram INTEGER NOT NULL,
  cpu INTEGER NOT NULL,
  storage INTEGER NOT NULL,
  price REAL NOT NULL,
  duration_type TEXT NOT NULL CHECK (duration_type IN ('weekly', 'monthly', 'custom', 'days', 'lifetime')),
  duration_days INTEGER NOT NULL,
  limited_stock INTEGER NOT NULL DEFAULT 0,
  stock_amount INTEGER,
  backup_count INTEGER NOT NULL DEFAULT 0,
  extra_ports INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS servers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  plan_type TEXT NOT NULL CHECK (plan_type IN ('coin', 'real')),
  plan_id INTEGER NOT NULL,
  pterodactyl_server_id INTEGER,
  identifier TEXT,
  expires_at TEXT NOT NULL,
  suspended_at TEXT,
  grace_expires_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'deleted')),
  location TEXT NOT NULL DEFAULT '',
  software TEXT NOT NULL DEFAULT 'minecraft',
  egg_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS coin_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  coins_per_minute INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  coin_reward INTEGER NOT NULL,
  max_uses INTEGER NOT NULL,
  per_user_limit INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  ip_address TEXT NOT NULL,
  redeemed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (coupon_id) REFERENCES coupons(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS utr_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  utr_number TEXT NOT NULL,
  screenshot_path TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
CREATE INDEX IF NOT EXISTS idx_servers_expiry ON servers(expires_at);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON coupon_redemptions(coupon_id);

-- ─── Dynamic Front Page ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS site_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_name TEXT NOT NULL UNIQUE,
  content_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS landing_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  ram INTEGER NOT NULL DEFAULT 1,
  cpu INTEGER NOT NULL DEFAULT 1,
  storage INTEGER NOT NULL DEFAULT 10,
  features TEXT NOT NULL DEFAULT '[]',
  popular INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_landing_plans_active ON landing_plans(active);

-- ─── Dynamic Site Settings & CMS ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_name TEXT,
  background_image TEXT,
  background_overlay_opacity REAL,
  favicon_path TEXT,
  hero_title TEXT,
  hero_subtitle TEXT,
  maintenance_mode INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  ram INTEGER,
  cpu INTEGER,
  storage INTEGER,
  price REAL,
  description TEXT,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS features (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  description TEXT,
  icon TEXT
);

CREATE TABLE IF NOT EXISTS vouchers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  coins INTEGER,
  expires_at TEXT,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT,
  is_active INTEGER DEFAULT 1
);

-- ─── Server Backups (tracked manual/automatic backups) ───────────────────────

CREATE TABLE IF NOT EXISTS server_backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER NOT NULL,
  pterodactyl_backup_uuid TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'backup',
  is_automatic INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (server_id) REFERENCES servers(id)
);

CREATE INDEX IF NOT EXISTS idx_server_backups_server ON server_backups(server_id);
