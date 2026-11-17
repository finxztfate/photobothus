USE photobothus;

ALTER TABLE events
  ADD COLUMN completed_at TIMESTAMP NULL DEFAULT NULL AFTER is_active;
