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

INSERT INTO app_settings (setting_key, setting_value)
SELECT 'spotlight_tz', 'Asia/Manila'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM app_settings WHERE setting_key = 'spotlight_tz'
);
