USE photobothus;

ALTER TABLE strips
  ADD COLUMN guest_key VARCHAR(64) DEFAULT NULL AFTER user_id,
  ADD KEY idx_strips_event_guest (event_id, guest_key);
