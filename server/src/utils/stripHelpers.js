const { pool } = require('../db');
const { signStripImageAccess, stripImageUrl } = require('./imageAccess');
const { removeStoredFile } = require('./upload');

async function mapStripRow(row, extra = {}) {
  const access = await signStripImageAccess(row.id);
  return {
    id: row.id,
    userId: row.user_id,
    guestKey: row.guest_key || null,
    eventId: row.event_id,
    title: row.title,
    imageUrl: stripImageUrl(row.id, access),
    createdAt: row.created_at,
    ...extra,
  };
}

async function mapStripRows(rows, extraFn) {
  return Promise.all(
    rows.map((row) => mapStripRow(row, typeof extraFn === 'function' ? extraFn(row) : extraFn || {}))
  );
}

async function canAccessStripImage(strip, user, guestKey) {
  if (guestKey && strip.guest_key && strip.guest_key === guestKey && strip.event_id) {
    return true;
  }
  if (!user) return false;
  if (strip.user_id && strip.user_id === user.id) return true;
  if (strip.event_id) {
    const [events] = await pool.query(
      'SELECT owner_id, is_active FROM events WHERE id = ? LIMIT 1',
      [strip.event_id]
    );
    if (events.length && events[0].owner_id === user.id) {
      return !events[0].is_active;
    }
  }
  return false;
}

async function deleteStripById(id) {
  const [rows] = await pool.query('SELECT id, image_url FROM strips WHERE id = ? LIMIT 1', [id]);
  if (!rows.length) return false;

  const imageUrl = rows[0].image_url;
  await pool.query('DELETE FROM strips WHERE id = ?', [id]);
  removeStoredFile(imageUrl);
  return true;
}

/** Removes every photo for one event from the database and from disk. */
async function deleteEventPhotos(eventId) {
  const [strips] = await pool.query(
    'SELECT id, image_url FROM strips WHERE event_id = ?',
    [eventId]
  );
  if (!strips.length) return 0;
  await pool.query('DELETE FROM strips WHERE event_id = ?', [eventId]);
  strips.forEach((strip) => removeStoredFile(strip.image_url));
  return strips.length;
}

async function deleteEventAndFiles(id) {
  const [strips] = await pool.query('SELECT image_url FROM strips WHERE event_id = ?', [id]);
  const [result] = await pool.query('DELETE FROM events WHERE id = ?', [id]);
  if (!result.affectedRows) return false;
  strips.forEach((strip) => removeStoredFile(strip.image_url));
  return true;
}

module.exports = {
  mapStripRow,
  mapStripRows,
  canAccessStripImage,
  deleteStripById,
  deleteEventPhotos,
  deleteEventAndFiles,
};
