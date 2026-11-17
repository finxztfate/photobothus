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

const pool = mysql.createPool({
  ...getDbConfig(),
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = { pool, getDbConfig };
