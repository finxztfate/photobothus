const express = require('express');
const { pool } = require('../db');
const { upload, prepareUploadedImage, discardUploadedFile, removeStoredFile } = require('../utils/upload');
const { mapStripRow, parseLookJson, storedKeysForStrip } = require('../utils/stripHelpers');
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

const uploadSession = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'photos', maxCount: 8 },
]);

function sessionFiles(req) {
  return {
    image: req.files?.image?.[0] || req.file || null,
    photos: req.files?.photos || [],
  };
}

function discardSessionFiles(req) {
  const { image, photos } = sessionFiles(req);
  discardUploadedFile(image);
  photos.forEach(discardUploadedFile);
}

function parseLayoutId(value) {
  if (value == null || value === '') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1 || id > 20) return null;
  return id;
}

function serializeLook(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return JSON.stringify(value);
  const parsed = parseLookJson(value);
  return parsed ? JSON.stringify(parsed) : null;
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

router.post('/events/:code/strips', uploadSession, async (req, res) => {
  let committed = false;
  const preparedKeys = [];
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

    const { image, photos } = sessionFiles(req);
    if (!image && !photos.length) {
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
    const photoKeys = photos.map((file) => {
      const key = prepareUploadedImage(file);
      preparedKeys.push(key);
      return key;
    });
    const imageUrl = image
      ? prepareUploadedImage(image)
      : photoKeys[0];
    if (image) preparedKeys.push(imageUrl);

    const layoutId = parseLayoutId(req.body.layoutId);
    const photoUrlsJson = photoKeys.length ? JSON.stringify(photoKeys) : null;
    const lookJson = serializeLook(req.body.look);

    const [result] = await pool.query(
      `INSERT INTO strips (user_id, guest_key, event_id, title, image_url, layout_id, photo_urls, look_json)
       VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)`,
      [guestKey, events[0].id, title, imageUrl, layoutId, photoUrlsJson, lookJson]
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
    if (!committed) {
      discardSessionFiles(req);
      preparedKeys.forEach(removeStoredFile);
    }
  }
});

router.patch('/events/:code/strips/:id', uploadSession, async (req, res) => {
  let committed = false;
  let newImageKey = null;
  try {
    const code = String(req.params.code || '').trim().toLowerCase();
    const guestKey = normalizeGuestKey(req.body.guestKey);
    await closeExpiredEventsQuietly();
    const [events] = await pool.query(
      'SELECT id, is_active FROM events WHERE code = ? LIMIT 1',
      [code]
    );
    if (!events.length) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (!events[0].is_active) {
      return res.status(403).json({ error: 'This event is closed' });
    }
    if (!guestKey) {
      return res.status(400).json({ error: 'Guest key is required for event uploads' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM strips WHERE id = ? AND event_id = ? AND guest_key = ? LIMIT 1',
      [req.params.id, events[0].id, guestKey]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Strip not found' });
    }

    const { image } = sessionFiles(req);
    const lookJson = serializeLook(req.body.look);
    if (!image && lookJson == null) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    if (image) {
      newImageKey = prepareUploadedImage(image);
    }

    await pool.query(
      'UPDATE strips SET image_url = COALESCE(?, image_url), look_json = COALESCE(?, look_json) WHERE id = ?',
      [newImageKey, lookJson, rows[0].id]
    );
    committed = true;

    if (newImageKey && rows[0].image_url && rows[0].image_url !== newImageKey) {
      const keep = new Set(storedKeysForStrip({ ...rows[0], image_url: newImageKey }));
      if (!keep.has(rows[0].image_url)) removeStoredFile(rows[0].image_url);
    }

    const [updated] = await pool.query('SELECT * FROM strips WHERE id = ?', [rows[0].id]);
    const maxGuestUploads = await getMaxGuestUploads();
    const [[countRow]] = await pool.query(
      'SELECT COUNT(*) AS count FROM strips WHERE event_id = ? AND guest_key = ?',
      [events[0].id, guestKey]
    );
    const uploadCount = Number(countRow.count);
    res.json({
      strip: await mapStripRow(updated[0]),
      maxGuestUploads,
      guestUploadCount: uploadCount,
      uploadsRemaining: Math.max(0, maxGuestUploads - uploadCount),
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status === 400 ? err.message : 'Failed to update strip' });
  } finally {
    if (!committed) {
      discardSessionFiles(req);
      if (newImageKey) removeStoredFile(newImageKey);
    }
  }
});

module.exports = router;
