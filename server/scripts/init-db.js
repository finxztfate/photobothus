require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { getDbConfig } = require('../src/db');

const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
const DEFAULT_ADMIN_PASSWORD = 'admin123';
const ADMIN_EMAIL = 'admin@photobothus.local';

async function isDefaultAdminHash(stored) {
  const value = String(stored || '');
  if (!value || value === DEFAULT_ADMIN_PASSWORD) return true;
  if (!value.startsWith('$2')) return false;
  try {
    return await bcrypt.compare(DEFAULT_ADMIN_PASSWORD, value);
  } catch {
    return false;
  }
}

async function ensureAdminFromEnv(connection) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    if (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production') {
      console.warn(
        'ADMIN_PASSWORD is not set. No bootstrap admin will be created; set it and redeploy to enable /admin/login.'
      );
    }
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  const [admins] = await connection.query(
    "SELECT id, email, password_hash FROM users WHERE role = 'admin' OR email = ? ORDER BY id ASC",
    [ADMIN_EMAIL]
  );

  if (!admins.length) {
    await connection.query(
      'INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
      [ADMIN_EMAIL, hash, 'Admin', 'admin']
    );
    console.log(`Created admin ${ADMIN_EMAIL} from ADMIN_PASSWORD`);
    return;
  }

  // Only replaces the public default (including old plaintext seeds), so a password
  // changed later in admin settings is kept.
  for (const admin of admins) {
    if (await isDefaultAdminHash(admin.password_hash)) {
      await connection.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, admin.id]);
      console.log(`Replaced default password for admin #${admin.id}`);
    }
  }
}

// schema.sql uses CREATE TABLE IF NOT EXISTS, which leaves an existing events
// table as it is. Add the schedule columns to databases created before them.
async function ensureEventScheduleColumns(connection, database) {
  const [columns] = await connection.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'events' AND COLUMN_NAME IN ('starts_at', 'ends_at')`,
    [database]
  );
  const existing = new Set(columns.map((column) => column.name));
  const changes = [];
  if (!existing.has('starts_at')) {
    changes.push('ADD COLUMN starts_at DATETIME NULL DEFAULT NULL AFTER event_date');
  }
  if (!existing.has('ends_at')) {
    changes.push('ADD COLUMN ends_at DATETIME NULL DEFAULT NULL AFTER starts_at');
  }

  const [indexes] = await connection.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'events' AND INDEX_NAME = 'idx_events_auto_close' LIMIT 1`,
    [database]
  );
  if (!indexes.length) {
    changes.push('ADD KEY idx_events_auto_close (is_active, ends_at)');
  }

  if (changes.length) {
    await connection.query(`ALTER TABLE events ${changes.join(', ')}`);
    console.log('Added event start/end time columns');
  }
}

// Existing strips tables were created before Spotlight. Add the opt-in flag.
// The picks table itself is created by schema.sql.
async function ensureSpotlightColumn(connection, database) {
  const [columns] = await connection.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'strips' AND COLUMN_NAME = 'spotlight_opt_in' LIMIT 1`,
    [database]
  );
  if (!columns.length) {
    await connection.query(
      'ALTER TABLE strips ADD COLUMN spotlight_opt_in TINYINT(1) NOT NULL DEFAULT 0 AFTER image_url'
    );
    console.log('Added spotlight opt-in column');
  }

  const [details] = await connection.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'strips' AND COLUMN_NAME = 'spotlight_details' LIMIT 1`,
    [database]
  );
  if (!details.length) {
    await connection.query(
      'ALTER TABLE strips ADD COLUMN spotlight_details TEXT DEFAULT NULL AFTER spotlight_opt_in'
    );
    console.log('Added spotlight details column');
  }

  const [weekStart] = await connection.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'strips' AND COLUMN_NAME = 'spotlight_week_start' LIMIT 1`,
    [database]
  );
  if (!weekStart.length) {
    await connection.query(
      'ALTER TABLE strips ADD COLUMN spotlight_week_start DATE DEFAULT NULL AFTER spotlight_details'
    );
    console.log('Added spotlight week start column');
  }

  const [statusCol] = await connection.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'strips' AND COLUMN_NAME = 'spotlight_status' LIMIT 1`,
    [database]
  );
  if (!statusCol.length) {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'migrate_spotlight_status.sql'), 'utf8');
    await connection.query(sql);
    console.log('Added spotlight_status column');
  }
}

async function ensureStripSessionColumns(connection, database) {
  const [columns] = await connection.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'strips'
       AND COLUMN_NAME IN ('layout_id', 'photo_urls', 'look_json')`,
    [database]
  );
  const existing = new Set(columns.map((column) => column.name));
  const changes = [];
  if (!existing.has('layout_id')) {
    changes.push('ADD COLUMN layout_id INT UNSIGNED DEFAULT NULL AFTER image_url');
  }
  if (!existing.has('photo_urls')) {
    changes.push('ADD COLUMN photo_urls TEXT DEFAULT NULL AFTER layout_id');
  }
  if (!existing.has('look_json')) {
    changes.push('ADD COLUMN look_json TEXT DEFAULT NULL AFTER photo_urls');
  }
  if (changes.length) {
    await connection.query(`ALTER TABLE strips ${changes.join(', ')}`);
    console.log('Added strip session columns');
  }
}

async function ensureEventTickets(connection, database) {
  const [columns] = await connection.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
       AND COLUMN_NAME IN ('event_tickets', 'potw_wins')`,
    [database]
  );
  const existing = new Set(columns.map((column) => column.name));
  const changes = [];
  if (!existing.has('event_tickets')) {
    changes.push('ADD COLUMN event_tickets INT UNSIGNED NOT NULL DEFAULT 0 AFTER role');
  }
  if (!existing.has('potw_wins')) {
    changes.push('ADD COLUMN potw_wins INT UNSIGNED NOT NULL DEFAULT 0 AFTER event_tickets');
  }
  if (changes.length) {
    await connection.query(`ALTER TABLE users ${changes.join(', ')}`);
    console.log('Added event ticket columns');
  }
}

async function ensureSpotlightLikes(connection, database) {
  const [tables] = await connection.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'spotlight_likes' LIMIT 1`,
    [database]
  );
  if (!tables.length) {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'migrate_spotlight_likes.sql'), 'utf8');
    await connection.query(sql);
    console.log('Added spotlight_likes table');
  }
}

async function ensureFeedbackTable(connection, database) {
  const [tables] = await connection.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'feedback' LIMIT 1`,
    [database]
  );
  if (!tables.length) {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'migrate_feedback.sql'), 'utf8');
    await connection.query(sql);
    console.log('Added feedback table');
  }
}

async function main() {
  const schema = fs
    .readFileSync(schemaPath, 'utf8')
    // The target database comes from the env config, not the file.
    .replace(/^\s*CREATE DATABASE[\s\S]*?;\s*$/im, '')
    .replace(/^\s*USE\s+\S+;\s*$/im, '');

  const config = getDbConfig();
  const connection = await mysql.createConnection({ ...config, multipleStatements: true });
  try {
    await connection.query(schema);
    console.log(`Schema applied to "${config.database}" on ${config.host}:${config.port}`);
    await ensureEventScheduleColumns(connection, config.database);
    await ensureSpotlightColumn(connection, config.database);
    await ensureStripSessionColumns(connection, config.database);
    await ensureSpotlightLikes(connection, config.database);
    await ensureEventTickets(connection, config.database);
    await ensureFeedbackTable(connection, config.database);

    await ensureAdminFromEnv(connection);
  } finally {
    await connection.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to apply schema:', err.message);
    process.exit(1);
  });
