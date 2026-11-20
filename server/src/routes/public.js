const express = require('express');
const { pool } = require('../db');
const { upload, prepareUploadedImage, discardUploadedFile } = require('../utils/upload');
const { mapStripRow } = require('../utils/stripHelpers');
const { loadPublicSpotlight } = require('../utils/spotlight');
const { getMaxGuestUploads, getMaxEventUploads } = require('../utils/settings');
const { closeExpiredEventsQuietly, toDateOnly } = require('../utils/eventSchedule');

const router = express.Router();

router.get('/spotlight', async (_req, res) => {
  try {
    res.json(await loadPublicSpotlight());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load Spotlight' });
  }
});

function normalizeGuestKey(value) {
  const key = String(value || '').trim();
  if (!key || key.length < 8 || key.length > 64) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) return null;
  return key;
}

router.get('/events/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toLowerCase();
    const maxGuestUploads = await getMaxGuestUploads();
    await closeExpiredEventsQuietly();
    const [rows] = await pool.query(
      `SELECT id, name, host_name, event_date, starts_at, ends_at, location, welcome_message,
              hashtags, strips_enabled, code, is_active, created_at
       FROM events WHERE code = ? LIMIT 1`,
      [code]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = rows[0];

    const guestKey = normalizeGuestKey(req.query.guestKey);
    let uploadCount = 0;
    let uploadsRemaining = maxGuestUploads;

    if (guestKey) {
      const [[countRow]] = await pool.query(
        'SELECT COUNT(*) AS count FROM strips WHERE event_id = ? AND guest_key = ?',
        [event.id, guestKey]
      );
      uploadCount = Number(countRow.count);
      uploadsRemaining = Math.max(0, maxGuestUploads - uploadCount);
    }

    const maxEventUploads = await getMaxEventUploads();
    const [[totalRow]] = await pool.query(
      'SELECT COUNT(*) AS count FROM strips WHERE event_id = ?',
      [event.id]
    );
    const eventFull = Number(totalRow.count) >= maxEventUploads;

    res.json({
      event: {
        id: event.id,
        name: event.name,
        hostName: event.host_name,
        eventDate: toDateOnly(event.event_date),
        startsAt: event.starts_at || null,
        endsAt: event.ends_at || null,
        location: event.location,
        welcomeMessage: event.welcome_message,
        hashtags: event.hashtags,
        stripsEnabled: !!event.strips_enabled,
        code: event.code,
        isActive: !!event.is_active,
        createdAt: event.created_at,
        maxGuestUploads,
        guestUploadCount: uploadCount,
        uploadsRemaining,
        eventFull,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load event' });
  }
});

router.post('/events/:code/strips', upload.single('image'), async (req, res) => {
  let committed = false;
  try {
    const code = String(req.params.code || '').trim().toLowerCase();
    const guestKey = normalizeGuestKey(req.body.guestKey);
    const maxGuestUploads = await getMaxGuestUploads();
    // An upload that arrives after the event's end time is refused like any closed event.
    await closeExpiredEventsQuietly();
    const [events] = await pool.query(
      'SELECT id, is_active FROM events WHERE code = ? LIMIT 1',
      [code]
    );

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }
    if (!events.length) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (!events[0].is_active) {
      return res.status(403).json({ error: 'This event is closed' });
    }
    if (!guestKey) {
      return res.status(400).json({ error: 'Guest key is required for event uploads' });
    }

    // The per-guest limit below relies on a key the guest's browser makes up,
    // so a fresh key resets it. This total is counted on the server and holds
    // no matter what key is sent.
    const maxEventUploads = await getMaxEventUploads();
    const [[totalRow]] = await pool.query(
      'SELECT COUNT(*) AS count FROM strips WHERE event_id = ?',
      [events[0].id]
    );
    if (Number(totalRow.count) >= maxEventUploads) {
      return res.status(403).json({
        error: `This event's gallery is full (${maxEventUploads} photos). Ask the host to make room.`,
        code: 'EVENT_FULL',
        eventFull: true,
      });
    }

    const [[countRow]] = await pool.query(
      'SELECT COUNT(*) AS count FROM strips WHERE event_id = ? AND guest_key = ?',
      [events[0].id, guestKey]
    );
    const uploadCount = Number(countRow.count);
    if (uploadCount >= maxGuestUploads) {
      return res.status(403).json({
        error: `Upload limit reached. Guests can only upload ${maxGuestUploads} photos each.`,
        maxGuestUploads,
        guestUploadCount: uploadCount,
        uploadsRemaining: 0,
      });
    }

    const title = String(req.body.title || '').trim() || null;
    const imageUrl = prepareUploadedImage(req.file);

    const [result] = await pool.query(
      'INSERT INTO strips (user_id, guest_key, event_id, title, image_url) VALUES (NULL, ?, ?, ?, ?)',
      [guestKey, events[0].id, title, imageUrl]
    );
    committed = true;

    const [rows] = await pool.query('SELECT * FROM strips WHERE id = ?', [result.insertId]);
    const nextCount = uploadCount + 1;
    res.status(201).json({
      strip: await mapStripRow(rows[0]),
      maxGuestUploads,
      guestUploadCount: nextCount,
      uploadsRemaining: Math.max(0, maxGuestUploads - nextCount),
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status === 400 ? err.message : 'Failed to upload strip' });
  } finally {
    if (!committed) discardUploadedFile(req.file);
  }
});

module.exports = router;
