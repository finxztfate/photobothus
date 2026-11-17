require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { getDbConfig } = require('../src/db');

const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
const DEFAULT_ADMIN_PASSWORD = 'admin123';

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

    // Only replaces the public default, so a password changed later in admin settings is kept.
    if (process.env.ADMIN_PASSWORD) {
      const [admins] = await connection.query("SELECT id, password_hash FROM users WHERE role = 'admin'");
      for (const admin of admins) {
        if (admin.password_hash && (await bcrypt.compare(DEFAULT_ADMIN_PASSWORD, admin.password_hash))) {
          const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
          await connection.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, admin.id]);
          console.log(`Replaced default password for admin #${admin.id}`);
        }
      }
    }
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
