const express = require('express');
const yazl = require('yazl');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { generateEventCode, readStoredPhoto, extensionForMime } = require('../utils/upload');
const { mapStripRows, deleteStripById, deleteEventAndFiles } = require('../utils/stripHelpers');
const { closeExpiredEventsQuietly, readInstant, toDateOnly } = require('../utils/eventSchedule');
const { readPage, pageOf } = require('../utils/pagination');

const router = express.Router();

/** A name that is safe inside a ZIP and in a download header: letters, digits, "_", "." and "-". */
function safeFileName(value, fallback) {
  const cleaned = String(value || '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^[_.]+|[_.]+$/g, '')
    .slice(0, 60);
  return cleaned || fallback;
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function sendEventError(res, err, message) {
  if (err.status === 400) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  if (err.code === 'ER_BAD_FIELD_ERROR') {
    return res.status(500).json({ error: `${message}. Did you run migrate_event_schedule.sql?` });
  }
  return res.status(500).json({ error: message });
}

function normalizeHashtags(value) {
  if (!value) return null;
  const tags = String(value)
    .split(/[\s,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));
  return tags.length ? tags.join(' ') : null;
}

function mapEvent(row) {
  const isActive = !!row.is_active;
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    hostName: row.host_name || null,
    eventDate: toDateOnly(row.event_date),
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
    location: row.location || null,
    welcomeMessage: row.welcome_message || null,
    hashtags: row.hashtags || null,
    stripsEnabled: row.strips_enabled == null ? false : !!row.strips_enabled,
    code: row.code,
    isActive,
    status: isActive ? 'active' : 'completed',
    completedAt: row.completed_at || null,
    createdAt: row.created_at,
    stripCount: row.strip_count != null ? Number(row.strip_count) : undefined,
    guestCount: row.guest_count != null ? Number(row.guest_count) : undefined,
  };
}

function readEventFields(body, fallback = {}) {
  const name = body.name != null ? String(body.name).trim() : fallback.name;
  const hostName =
    body.hostName != null ? String(body.hostName).trim() || null : fallback.host_name ?? null;
  // undefined keeps the stored date; null or '' clears it.
  const eventDate =
    body.eventDate !== undefined
      ? String(body.eventDate ?? '').trim() || null
      : fallback.event_date ?? null;
  const startsAt = readInstant(body.startsAt, fallback.starts_at, 'Start time');
  const endsAt = readInstant(body.endsAt, fallback.ends_at, 'End time');
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw badRequest('The end time must be after the start time.');
  }
  const location =
    body.location != null ? String(body.location).trim() || null : fallback.location ?? null;
  const welcomeMessage =
    body.welcomeMessage != null
      ? String(body.welcomeMessage).trim() || null
      : fallback.welcome_message ?? null;
  const hashtags =
    body.hashtags != null
      ? normalizeHashtags(body.hashtags)
      : fallback.hashtags ?? null;
  const stripsEnabled =
    body.stripsEnabled != null
      ? body.stripsEnabled ? 1 : 0
      : fallback.strips_enabled != null
        ? fallback.strips_enabled
        : 0;

  return {
    name,
    hostName,
    eventDate,
    startsAt,
    endsAt,
    location,
    welcomeMessage,
    hashtags,
    stripsEnabled,
  };
}

router.use(requireAuth);

// Events past their end time are closed before any host request reads them,
// so the dashboard never shows an ended event as live.
router.use(async (_req, _res, next) => {
  await closeExpiredEventsQuietly();
  next();
});

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.*, COUNT(s.id) AS strip_count
       FROM events e
       LEFT JOIN strips s ON s.event_id = e.id
       WHERE e.owner_id = ?
       GROUP BY e.id
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );
    res.json({ events: rows.map(mapEvent) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list events' });
  }
});

router.post('/', async (req, res) => {
  try {
    const fields = readEventFields(req.body);
    if (!fields.name) {
      return res.status(400).json({ error: 'Event title is required' });
    }
    if (fields.endsAt && fields.endsAt <= new Date()) {
      return res.status(400).json({ error: 'That end time has already passed. Choose a later time.' });
    }

    let code = generateEventCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const [result] = await pool.query(
          `INSERT INTO events
            (owner_id, name, host_name, event_date, starts_at, ends_at, location,
             welcome_message, hashtags, strips_enabled, code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            fields.name,
            fields.hostName,
            fields.eventDate,
            fields.startsAt,
            fields.endsAt,
            fields.location,
            fields.welcomeMessage,
            fields.hashtags,
            fields.stripsEnabled,
            code,
          ]
        );
        const [rows] = await pool.query('SELECT * FROM events WHERE id = ?', [result.insertId]);
        return res.status(201).json({ event: mapEvent({ ...rows[0], strip_count: 0 }) });
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          code = generateEventCode();
          continue;
        }
        throw err;
      }
    }
    res.status(500).json({ error: 'Could not generate unique event code' });
  } catch (err) {
    sendEventError(res, err, 'Failed to create event');
  }
});

router.get('/:id', async (req, res) => {
  try {
    // The totals are counted here because the gallery is loaded a page at a
    // time, so the page in hand no longer says how many photos or guests there are.
    const [rows] = await pool.query(
      `SELECT e.*, COUNT(s.id) AS strip_count, COUNT(DISTINCT s.guest_key) AS guest_count
       FROM events e
       LEFT JOIN strips s ON s.event_id = e.id
       WHERE e.id = ? AND e.owner_id = ?
       GROUP BY e.id`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ event: mapEvent(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load event' });
  }
});

// Download All: every photo of the event in one ZIP, streamed straight from disk.
router.get('/:id/download', async (req, res) => {
  try {
    const [events] = await pool.query(
      'SELECT id, name, is_active FROM events WHERE id = ? AND owner_id = ? LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!events.length) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (events[0].is_active) {
      return res.status(403).json({ error: 'Guest photos can be viewed after the event ends.' });
    }

    const [rows] = await pool.query(
      'SELECT id, title, image_url FROM strips WHERE event_id = ? ORDER BY id ASC',
      [events[0].id]
    );
    // A photo whose file has gone missing is left out instead of failing the whole download.
    const files = rows
      .map((row) => ({ row, photo: readStoredPhoto(row.image_url) }))
      .filter(({ photo }) => photo);
    if (!files.length) {
      return res.status(404).json({ error: 'No photos to download' });
    }

    const zip = new yazl.ZipFile();
    zip.on('error', (err) => {
      console.error(err);
      res.destroy(err);
    });
    files.forEach(({ row, photo }, index) => {
      const number = String(index + 1).padStart(3, '0');
      const name = `${number}-${safeFileName(row.title, 'photo')}${extensionForMime(photo.mime)}`;
      // Images are already compressed, so they are stored as they are.
      zip.addBuffer(photo.buffer, name, { compress: false });
    });

    res.set('Content-Type', 'application/zip');
    res.set(
      'Content-Disposition',
      `attachment; filename="${safeFileName(events[0].name, 'event')}-photos.zip"`
    );
    zip.outputStream.pipe(res);
    zip.end();
  } catch (err) {
    console.error(err);
    if (res.headersSent) {
      res.destroy(err);
      return;
    }
    res.status(500).json({ error: 'Failed to download photos' });
  }
});

router.get('/:id/strips', async (req, res) => {
  try {
    const [events] = await pool.query(
      'SELECT id, is_active FROM events WHERE id = ? AND owner_id = ? LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!events.length) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (events[0].is_active) {
      return res.json({ strips: [], hasMore: false, nextCursor: null, photosLocked: true });
    }

    const { limit, before } = readPage(req.query);
    const [rows] = await pool.query(
      `SELECT id, user_id, guest_key, event_id, title, image_url, created_at
       FROM strips
       WHERE event_id = ? AND (? IS NULL OR id < ?)
       ORDER BY id DESC
       LIMIT ?`,
      [events[0].id, before, before, limit + 1]
    );
    const { page, hasMore, nextCursor } = pageOf(rows, limit);
    res.json({ strips: await mapStripRows(page), hasMore, nextCursor });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load event strips' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const [events] = await pool.query(
      'SELECT * FROM events WHERE id = ? AND owner_id = ? LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!events.length) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const current = events[0];
    const fields = readEventFields(req.body, current);
    if (req.body.isActive && !current.is_active) {
      return res.status(400).json({ error: 'A completed event cannot be reopened.' });
    }
    const isActive =
      req.body.isActive != null ? (req.body.isActive ? 1 : 0) : current.is_active;

    if (!fields.name) {
      return res.status(400).json({ error: 'Event title is required' });
    }

    // Ending an event marks it completed for History. It stays completed.
    let completedAt = current.completed_at;
    if (req.body.isActive != null && !isActive) {
      completedAt = current.completed_at || new Date();
    }

    if (isActive && fields.endsAt && fields.endsAt <= new Date() && req.body.endsAt !== undefined) {
      return res.status(400).json({
        error: 'That end time has already passed. Choose a later time, or end the event from its dashboard.',
      });
    }

    await pool.query(
      `UPDATE events
       SET name = ?, host_name = ?, event_date = ?, starts_at = ?, ends_at = ?, location = ?,
           welcome_message = ?, hashtags = ?, strips_enabled = ?, is_active = ?, completed_at = ?
       WHERE id = ?`,
      [
        fields.name,
        fields.hostName,
        fields.eventDate,
        fields.startsAt,
        fields.endsAt,
        fields.location,
        fields.welcomeMessage,
        fields.hashtags,
        fields.stripsEnabled,
        isActive,
        completedAt,
        req.params.id,
      ]
    );

    const [rows] = await pool.query(
      `SELECT e.*, COUNT(s.id) AS strip_count, COUNT(DISTINCT s.guest_key) AS guest_count
       FROM events e
       LEFT JOIN strips s ON s.event_id = e.id
       WHERE e.id = ?
       GROUP BY e.id`,
      [req.params.id]
    );

    res.json({ event: mapEvent(rows[0]) });
  } catch (err) {
    sendEventError(res, err, 'Failed to update event');
  }
});

// Host moderation: remove one photo from the host's own event gallery.
// The join on owner_id means a host can never touch another host's photos.
router.delete('/:id/strips/:stripId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id
       FROM strips s
       JOIN events e ON e.id = s.event_id
       WHERE s.id = ? AND s.event_id = ? AND e.owner_id = ?
       LIMIT 1`,
      [req.params.stripId, req.params.id, req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    await deleteStripById(rows[0].id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove photo' });
  }
});

// Deletes the event, every photo uploaded to it, and the stored image files.
router.delete('/:id', async (req, res) => {
  try {
    const [events] = await pool.query(
      'SELECT id FROM events WHERE id = ? AND owner_id = ? LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!events.length) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await deleteEventAndFiles(events[0].id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;
