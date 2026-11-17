USE photobothus;

ALTER TABLE events
  ADD COLUMN host_name VARCHAR(255) DEFAULT NULL AFTER name,
  ADD COLUMN event_date DATE DEFAULT NULL AFTER host_name,
  ADD COLUMN location VARCHAR(255) DEFAULT NULL AFTER event_date,
  ADD COLUMN welcome_message TEXT DEFAULT NULL AFTER location,
  ADD COLUMN hashtags VARCHAR(500) DEFAULT NULL AFTER welcome_message;
