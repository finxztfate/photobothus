USE photobothus;

-- A customer can allow one of their own saved strips to be considered for Spotlight.
ALTER TABLE strips
  ADD COLUMN spotlight_opt_in TINYINT(1) NOT NULL DEFAULT 0 AFTER image_url;

ALTER TABLE strips
  ADD COLUMN spotlight_details TEXT DEFAULT NULL AFTER spotlight_opt_in;

-- The current Photo of the Week (slot week) and up to three home-carousel picks.
CREATE TABLE IF NOT EXISTS spotlight_picks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  strip_id INT UNSIGNED NOT NULL,
  slot ENUM('week', 'home') NOT NULL,
  caption VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_spotlight_slot (slot),
  CONSTRAINT fk_spotlight_strip
    FOREIGN KEY (strip_id) REFERENCES strips (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;
