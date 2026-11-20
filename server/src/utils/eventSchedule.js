const { pool } = require('../db');

// Times are compared against a Date supplied by Node rather than MySQL's NOW(),
// so the comparison uses the same clock and timezone the values were written with.

/**
 * Closes every live event whose end time has passed. A closed event is identical
 * to one the host ended by hand, with the end time recorded as its completion.
 */
async function closeExpiredEvents(now = new Date()) {
  const [result] = await pool.query(
    `UPDATE events
     SET is_active = 0, completed_at = ends_at
     WHERE is_active = 1 AND ends_at IS NOT NULL AND ends_at <= ?`,
    [now]
  );
  return result.affectedRows || 0;
}

/** Same as closeExpiredEvents, but a failure never blocks the request that asked. */
async function closeExpiredEventsQuietly() {
  try {
    await closeExpiredEvents();
  } catch (err) {
    console.error('Could not auto-close ended events:', err.message);
  }
}

/** Keeps admin views and idle events up to date when nobody is loading an event page. */
function startAutoCloseTimer(intervalMs = 60 * 1000) {
  let lastError = '';
  const timer = setInterval(() => {
    closeExpiredEvents()
      .then(() => {
        lastError = '';
      })
      .catch((err) => {
        // Log a repeating failure once, not every minute.
        if (err.message !== lastError) {
          lastError = err.message;
          console.error('Could not auto-close ended events:', err.message);
        }
      });
  }, intervalMs);
  timer.unref();
  return timer;
}

/**
 * Reads a start/end time from a request body.
 * undefined keeps the stored value, null or '' clears it.
 */
function readInstant(value, fallback, label) {
  if (value === undefined) return fallback ?? null;
  if (value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const err = new Error(`${label} is not a valid date and time`);
    err.status = 400;
    throw err;
  }
  return date;
}

/**
 * MySQL DATE columns arrive as a Date at local midnight. Sending that as JSON
 * shifts it to the previous day in timezones ahead of UTC, so send the calendar
 * date itself.
 */
function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  return String(value).slice(0, 10);
}

module.exports = {
  closeExpiredEvents,
  closeExpiredEventsQuietly,
  startAutoCloseTimer,
  readInstant,
  toDateOnly,
};
