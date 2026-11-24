const mysql = require('mysql2/promise');

// DB_* vars win; MYSQL_URL / MYSQL* are what Railway's MySQL service exposes.
function getDbConfig() {
  const url = process.env.DB_URL || process.env.MYSQL_URL;
  if (url && !process.env.DB_HOST) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, '') || 'photobothus',
    };
  }

  return {
    host: process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD ?? process.env.MYSQLPASSWORD ?? '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'photobothus',
  };
}

function readPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

// Bound the pool so a traffic spike fails with a fast error instead of
// waiting forever for a free connection (which looks like a hang).
const pool = mysql.createPool({
  ...getDbConfig(),
  waitForConnections: true,
  connectionLimit: readPositiveInt(process.env.DB_POOL_SIZE, 10),
  queueLimit: readPositiveInt(process.env.DB_QUEUE_LIMIT, 50),
  connectTimeout: readPositiveInt(process.env.DB_CONNECT_TIMEOUT_MS, 10_000),
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

function isPoolBusyError(err) {
  if (!err) return false;
  const message = String(err.message || '');
  return (
    err.code === 'ER_CON_COUNT_ERROR' ||
    /queue limit reached/i.test(message) ||
    /no connections available/i.test(message)
  );
}

module.exports = { pool, getDbConfig, isPoolBusyError };
