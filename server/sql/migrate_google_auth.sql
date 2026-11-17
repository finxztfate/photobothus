-- Run if you already imported the old schema
USE photobothus;

ALTER TABLE users
  MODIFY password_hash VARCHAR(255) DEFAULT NULL,
  ADD COLUMN google_id VARCHAR(255) DEFAULT NULL AFTER password_hash,
  ADD COLUMN avatar_url VARCHAR(500) DEFAULT NULL AFTER display_name;

ALTER TABLE users
  ADD UNIQUE KEY uq_users_google_id (google_id);
