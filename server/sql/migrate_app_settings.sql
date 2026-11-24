USE photobothus;

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(100) NOT NULL,
  setting_value VARCHAR(500) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB;

INSERT INTO app_settings (setting_key, setting_value)
SELECT 'max_guest_uploads', '2'
WHERE NOT EXISTS (
  SELECT 1 FROM app_settings WHERE setting_key = 'max_guest_uploads'
);

UPDATE app_settings SET setting_value = '2'
WHERE setting_key = 'max_guest_uploads' AND setting_value IN ('3', '4', '10');

INSERT INTO app_settings (setting_key, setting_value)
SELECT 'image_access_ttl_hours', '24'
WHERE NOT EXISTS (
  SELECT 1 FROM app_settings WHERE setting_key = 'image_access_ttl_hours'
);

INSERT INTO app_settings (setting_key, setting_value)
SELECT 'event_creation_enabled', '1'
WHERE NOT EXISTS (
  SELECT 1 FROM app_settings WHERE setting_key = 'event_creation_enabled'
);
