const express = require('express');
const { pool } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { upload, prepareUploadedImage, discardUploadedFile, readStoredPhoto } = require('../utils/upload');
const { verifyStripImageAccess } = require('../utils/imageAccess');
const {
  mapStripRow,
  mapStripRows,
  canAccessStripImage,
  deleteStripById,
  parsePhotoUrls,
} = require('../utils/stripHelpers');
const { readPage, pageOf } = require('../utils/pagination');
const { readSpotlightDetails, parseSpotlightDetails } = require('../utils/spotlightDetails');
const { weekStartKey, getSpotlightTz } = require('../utils/spotlight');

const router = express.Router();

const stripUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.STRIP_UPLOAD_RATE_MAX || 60),
  message: 'Too many uploads. Please wait a few minutes and try again.',
});

function normalizeGuestKey(value) {
  const key = String(value || '').trim();
  if (!key || key.length < 8 || key.length > 64) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) return null;
  return key;
}

router.get('/:id/image', optionalAuth, async (req, res) => {
  try {
    const stripId = req.params.id;
    const accessToken = req.query.access;
    const guestKey = normalizeGuestKey(req.query.guestKey);

    const [rows] = await pool.query('SELECT * FROM strips WHERE id = ? LIMIT 1', [stripId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const strip = rows[0];
    const allowed =
      verifyStripImageAccess(accessToken, stripId) ||
      (await canAccessStripImage(strip, req.user, guestKey));

    if (!allowed) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const slotRaw = req.query.slot;
    const slot = slotRaw == null || slotRaw === '' ? null : Number(slotRaw);
    const cellKeys = parsePhotoUrls(strip.photo_urls);
    const stored =
      slot != null && Number.isInteger(slot) && slot >= 0 && slot < cellKeys.length
        ? cellKeys[slot]
        : strip.image_url;
    const photo = await readStoredPhoto(stored);
    if (!photo) {
      return res.status(404).json({ error: 'Image file not found' });
    }

    res.set('Content-Type', photo.mime);
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(photo.buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load image' });
  }
});

router.use(requireAuth);

router.delete('/', async (req, res) => {
  try {
    const ids = [...new Set(
      (Array.isArray(req.body.ids) ? req.body.ids : [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )];
    if (!ids.length) {
      return res.status(400).json({ error: 'Choose at least one photo' });
    }
    if (ids.length > 100) {
      return res.status(400).json({ error: 'Delete up to 100 photos at a time' });
    }

    const [rows] = await pool.query(
      `SELECT id, image_url FROM strips
       WHERE user_id = ? AND event_id IS NULL AND id IN (${ids.map(() => '?').join(', ')})`,
      [req.user.id, ...ids]
    );
    if (rows.length !== ids.length) {
      return res.status(404).json({ error: 'One or more photos were not found' });
    }

    for (const row of rows) {
      await deleteStripById(row.id);
    }
    res.json({ ok: true, deleted: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete photos' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { limit, before } = readPage(req.query);
    const [rows] = await pool.query(
      `SELECT id, user_id, event_id, title, image_url, layout_id, spotlight_opt_in, spotlight_details, created_at
       FROM strips
       WHERE user_id = ? AND event_id IS NULL AND (? IS NULL OR id < ?)
       ORDER BY id DESC
       LIMIT ?`,
      [req.user.id, before, before, limit + 1]
    );
    const { page, hasMore, nextCursor } = pageOf(rows, limit);
    res.json({
      strips: await mapStripRows(page, (row) => ({
        spotlightOptIn: !!row.spotlight_opt_in,
        spotlightDetails: parseSpotlightDetails(row.spotlight_details),
      })),
      hasMore,
      nextCursor,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list strips' });
  }
});

router.post('/', stripUploadLimiter, upload.single('image'), async (req, res) => {
  let committed = false;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const title = String(req.body.title || '').trim() || null;
    const imageUrl = await prepareUploadedImage(req.file);

    const [result] = await pool.query(
      'INSERT INTO strips (user_id, event_id, title, image_url) VALUES (?, NULL, ?, ?)',
      [req.user.id, title, imageUrl]
    );
    committed = true;

    const [rows] = await pool.query('SELECT * FROM strips WHERE id = ?', [result.insertId]);
    res.status(201).json({ strip: await mapStripRow(rows[0]) });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    const message =
      status === 400 || status === 503 ? err.message : 'Failed to save strip';
    res.status(status).json({ error: message });
  } finally {
    if (!committed) await discardUploadedFile(req.file);
  }
});

// Only a signed-in customer can send their own saved strip to Spotlight.
router.patch('/:id', async (req, res) => {
  try {
    if (typeof req.body.spotlightOptIn !== 'boolean') {
      return res.status(400).json({ error: 'spotlightOptIn must be true or false' });
    }

    const [rows] = await pool.query(
      'SELECT id FROM strips WHERE id = ? AND user_id = ? AND event_id IS NULL LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Strip not found' });
    }

    if (!req.body.spotlightOptIn) {
      await pool.query(
        'UPDATE strips SET spotlight_opt_in = 0, spotlight_week_start = NULL WHERE id = ?',
        [rows[0].id]
      );
      await pool.query('DELETE FROM spotlight_picks WHERE strip_id = ?', [rows[0].id]);
      await pool.query('DELETE FROM spotlight_likes WHERE strip_id = ?', [rows[0].id]);
      return res.json({ ok: true, spotlightOptIn: false });
    }

    const parsed = readSpotlightDetails(req.body.details);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const [others] = await pool.query(
      `SELECT id FROM strips
       WHERE user_id = ? AND id <> ? AND event_id IS NULL AND spotlight_opt_in = 1
       LIMIT 1`,
      [req.user.id, rows[0].id]
    );
    if (others.length) {
      return res.status(409).json({
        error: 'You can only have one strip on Spotlight. Remove the current one first.',
        code: 'SPOTLIGHT_ENTRY_LIMIT',
        existingStripId: others[0].id,
      });
    }

    const tz = await getSpotlightTz();
    const weekKey = weekStartKey(new Date(), tz);
    await pool.query(
      'UPDATE strips SET spotlight_opt_in = ?, spotlight_details = ?, spotlight_week_start = ? WHERE id = ?',
      [1, JSON.stringify(parsed.details), weekKey, rows[0].id]
    );
    res.json({
      ok: true,
      spotlightOptIn: true,
      spotlightDetails: parsed.details,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update Spotlight permission' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM strips WHERE id = ? AND user_id = ? AND event_id IS NULL LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Strip not found' });
    }

    await deleteStripById(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete strip' });
  }
});

module.exports = router;
