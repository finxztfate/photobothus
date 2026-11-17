USE photobothus;

-- Optional start and end time for an event. An event closes automatically at ends_at.
ALTER TABLE events
  ADD COLUMN starts_at DATETIME NULL DEFAULT NULL AFTER event_date,
  ADD COLUMN ends_at DATETIME NULL DEFAULT NULL AFTER starts_at,
  ADD KEY idx_events_auto_close (is_active, ends_at);
