USE photobothus;

ALTER TABLE strips
  ADD COLUMN layout_id INT UNSIGNED DEFAULT NULL AFTER image_url,
  ADD COLUMN photo_urls TEXT DEFAULT NULL AFTER layout_id,
  ADD COLUMN look_json TEXT DEFAULT NULL AFTER photo_urls;
