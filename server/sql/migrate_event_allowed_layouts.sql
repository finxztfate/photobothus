USE photobothus;

ALTER TABLE events
  ADD COLUMN allowed_layouts TEXT NULL DEFAULT NULL AFTER strips_enabled;
