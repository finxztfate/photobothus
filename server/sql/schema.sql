CREATE DATABASE IF NOT EXISTS photobothus
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE photobothus;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) DEFAULT NULL,
  google_id VARCHAR(255) DEFAULT NULL,
  display_name VARCHAR(100) DEFAULT NULL,
  avatar_url VARCHAR(500) DEFAULT NULL,
  role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_google_id (google_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS events (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_id INT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  host_name VARCHAR(255) DEFAULT NULL,
  event_date DATE DEFAULT NULL,
  starts_at DATETIME NULL DEFAULT NULL,
  ends_at DATETIME NULL DEFAULT NULL,
  location VARCHAR(255) DEFAULT NULL,
  welcome_message TEXT DEFAULT NULL,
  hashtags VARCHAR(500) DEFAULT NULL,
  strips_enabled TINYINT(1) NOT NULL DEFAULT 0,
  code VARCHAR(32) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_events_code (code),
  KEY idx_events_owner (owner_id),
  KEY idx_events_auto_close (is_active, ends_at),
  CONSTRAINT fk_events_owner
    FOREIGN KEY (owner_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS strips (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED DEFAULT NULL,
  guest_key VARCHAR(64) DEFAULT NULL,
  event_id INT UNSIGNED DEFAULT NULL,
  title VARCHAR(255) DEFAULT NULL,
  image_url VARCHAR(500) NOT NULL,
  layout_id INT UNSIGNED DEFAULT NULL,
  photo_urls TEXT DEFAULT NULL,
  look_json TEXT DEFAULT NULL,
  spotlight_opt_in TINYINT(1) NOT NULL DEFAULT 0,
  spotlight_details TEXT DEFAULT NULL,
  spotlight_week_start DATE DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_strips_user (user_id),
  KEY idx_strips_event (event_id),
  KEY idx_strips_event_guest (event_id, guest_key),
  CONSTRAINT fk_strips_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_strips_event
    FOREIGN KEY (event_id) REFERENCES events (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS spotlight_picks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  strip_id INT UNSIGNED NOT NULL,
  slot ENUM('week', 'home') NOT NULL,
  caption VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_spotlight_slot (slot),
  CONSTRAINT fk_spotlight_strip
    FOREIGN KEY (strip_id) REFERENCES strips (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS spotlight_likes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  strip_id INT UNSIGNED NOT NULL,
  week_start DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_spotlight_like (user_id, strip_id, week_start),
  KEY idx_spotlight_likes_week (week_start, strip_id),
  CONSTRAINT fk_spotlight_likes_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_spotlight_likes_strip
    FOREIGN KEY (strip_id) REFERENCES strips (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- Default admin password: admin123 (email/password only — not Google)
-- Regenerate with: npm run hash-password -- admin123
INSERT INTO users (email, password_hash, display_name, role)
SELECT
  'admin@photobothus.local',
  'admin123',
  'Admin',
  'admin'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'admin@photobothus.local'
);

CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED DEFAULT NULL,
  event_id INT UNSIGNED DEFAULT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'PHP',
  type ENUM('event_hosting', 'strip_pack', 'premium', 'other') NOT NULL DEFAULT 'event_hosting',
  status ENUM('pending', 'paid', 'refunded', 'failed') NOT NULL DEFAULT 'paid',
  note VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payments_user (user_id),
  KEY idx_payments_event (event_id),
  KEY idx_payments_created (created_at),
  KEY idx_payments_status (status),
  CONSTRAINT fk_payments_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_payments_event
    FOREIGN KEY (event_id) REFERENCES events (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(100) NOT NULL,
  setting_value VARCHAR(500) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB;

INSERT INTO app_settings (setting_key, setting_value)
SELECT 'max_guest_uploads', '4'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM app_settings WHERE setting_key = 'max_guest_uploads'
);

UPDATE app_settings SET setting_value = '4'
WHERE setting_key = 'max_guest_uploads' AND setting_value IN ('3', '10');

INSERT INTO app_settings (setting_key, setting_value)
SELECT 'image_access_ttl_hours', '24'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM app_settings WHERE setting_key = 'image_access_ttl_hours'
);

INSERT INTO app_settings (setting_key, setting_value)
SELECT 'event_creation_enabled', '1'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM app_settings WHERE setting_key = 'event_creation_enabled'
);

INSERT INTO app_settings (setting_key, setting_value)
SELECT 'spotlight_tz', 'Asia/Manila'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM app_settings WHERE setting_key = 'spotlight_tz'
);
