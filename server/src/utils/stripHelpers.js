const { pool } = require('../db');
const { signStripImageAccess, stripImageUrl } = require('./imageAccess');
const { removeStoredFile } = require('./upload');

function parsePhotoUrls(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

function parseLookJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function storedKeysForStrip(row) {
  const keys = [row.image_url, ...parsePhotoUrls(row.photo_urls)].filter(Boolean);
  return [...new Set(keys)];
}

async function mapStripRow(row, extra = {}) {
  const access = await signStripImageAccess(row.id);
  const photoKeys = parsePhotoUrls(row.photo_urls);
  return {
    id: row.id,
    userId: row.user_id,
    guestKey: row.guest_key || null,
    eventId: row.event_id,
    title: row.title,
    imageUrl: stripImageUrl(row.id, access),
    layoutId: row.layout_id != null ? Number(row.layout_id) : null,
    photoUrls: photoKeys.map((_, index) => stripImageUrl(row.id, access, index)),
    look: parseLookJson(row.look_json),
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
  const [rows] = await pool.query(
    'SELECT id, image_url, photo_urls FROM strips WHERE id = ? LIMIT 1',
    [id]
  );
  if (!rows.length) return false;

  const keys = storedKeysForStrip(rows[0]);
  await pool.query('DELETE FROM strips WHERE id = ?', [id]);
  keys.forEach(removeStoredFile);
  return true;
}

/** Removes every photo for one event from the database and from disk. */
async function deleteEventPhotos(eventId) {
  const [strips] = await pool.query(
    'SELECT id, image_url, photo_urls FROM strips WHERE event_id = ?',
    [eventId]
  );
  if (!strips.length) return 0;
  await pool.query('DELETE FROM strips WHERE event_id = ?', [eventId]);
  strips.forEach((strip) => storedKeysForStrip(strip).forEach(removeStoredFile));
  return strips.length;
}

async function deleteEventAndFiles(id) {
  const [strips] = await pool.query(
    'SELECT image_url, photo_urls FROM strips WHERE event_id = ?',
    [id]
  );
  const [result] = await pool.query('DELETE FROM events WHERE id = ?', [id]);
  if (!result.affectedRows) return false;
  strips.forEach((strip) => storedKeysForStrip(strip).forEach(removeStoredFile));
  return true;
}

module.exports = {
  parsePhotoUrls,
  parseLookJson,
  storedKeysForStrip,
  mapStripRow,
  mapStripRows,
  canAccessStripImage,
  deleteStripById,
  deleteEventPhotos,
  deleteEventAndFiles,
};
