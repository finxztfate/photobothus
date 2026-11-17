-- Revenue / payments for admin dashboard
USE photobothus;

CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED DEFAULT NULL,
  event_id INT UNSIGNED DEFAULT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'PHP',
  type ENUM('event_hosting', 'strip_pack', 'premium', 'other') NOT NULL DEFAULT 'event_hosting',
  status ENUM('pending', 'paid', 'refunded', 'failed') NOT NULL DEFAULT 'paid',
  note VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payments_user (user_id),
  KEY idx_payments_event (event_id),
  KEY idx_payments_created (created_at),
  KEY idx_payments_status (status),
  CONSTRAINT fk_payments_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_payments_event
    FOREIGN KEY (event_id) REFERENCES events (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;
