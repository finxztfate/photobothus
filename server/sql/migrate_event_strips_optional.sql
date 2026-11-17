USE photobothus;

ALTER TABLE events
  ADD COLUMN strips_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER hashtags;
