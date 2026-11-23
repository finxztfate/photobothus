const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { weekStartKey, getSpotlightTz } = require('../utils/spotlight');

const router = express.Router();

router.use(requireAuth);

async function eligibleStrip(stripId, weekKey) {
  const [rows] = await pool.query(
    `SELECT id FROM strips
     WHERE id = ? AND spotlight_opt_in = 1 AND event_id IS NULL AND user_id IS NOT NULL
       AND spotlight_week_start = ?
     LIMIT 1`,
    [stripId, weekKey]
  );
  return rows[0] || null;
}

router.post('/likes', async (req, res) => {
  try {
    const stripId = Number(req.body.stripId);
    if (!Number.isInteger(stripId) || stripId < 1) {
      return res.status(400).json({ error: 'A strip is required' });
    }
    const tz = await getSpotlightTz();
    const weekKey = weekStartKey(new Date(), tz);
    const strip = await eligibleStrip(stripId, weekKey);
    if (!strip) {
      return res.status(404).json({ error: 'Strip not found' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM spotlight_likes WHERE user_id = ? AND strip_id = ? AND week_start = ? LIMIT 1',
      [req.user.id, strip.id, weekKey]
    );
    if (!existing.length) {
      await pool.query(
        'INSERT INTO spotlight_likes (user_id, strip_id, week_start) VALUES (?, ?, ?)',
        [req.user.id, strip.id, weekKey]
      );
    }

    const [[countRow]] = await pool.query(
      'SELECT COUNT(*) AS count FROM spotlight_likes WHERE strip_id = ? AND week_start = ?',
      [strip.id, weekKey]
    );
    res.status(existing.length ? 200 : 201).json({
      ok: true,
      stripId: strip.id,
      liked: true,
      likeCount: Number(countRow.count),
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.json({ ok: true, liked: true });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to like strip' });
  }
});

router.delete('/likes/:stripId', async (req, res) => {
  try {
    const stripId = Number(req.params.stripId);
    if (!Number.isInteger(stripId) || stripId < 1) {
      return res.status(400).json({ error: 'A strip is required' });
    }

    const tz = await getSpotlightTz();
    const weekKey = weekStartKey(new Date(), tz);
    await pool.query(
      'DELETE FROM spotlight_likes WHERE user_id = ? AND strip_id = ? AND week_start = ?',
      [req.user.id, stripId, weekKey]
    );
    const [[countRow]] = await pool.query(
      'SELECT COUNT(*) AS count FROM spotlight_likes WHERE strip_id = ? AND week_start = ?',
      [stripId, weekKey]
    );
    res.json({
      ok: true,
      stripId,
      liked: false,
      likeCount: Number(countRow.count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove like' });
  }
});

module.exports = router;
