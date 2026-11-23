const { pool } = require('../db');
const { mapStripRow } = require('./stripHelpers');
const { parseSpotlightDetails } = require('./spotlightDetails');
const { getSetting } = require('./settings');
const { recordPotwWin } = require('./tickets');

const HOME_LIMIT = 3;
const WEEK_WIN_MIN_LIKES = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

async function getSpotlightTz() {
  return (await getSetting('spotlight_tz')) || 'Asia/Manila';
}

function tzOffsetMs(tz) {
  if (tz === 'UTC' || tz === 'Etc/UTC') return 0;
  return MANILA_OFFSET_MS;
}

function zonedYmd(date, tz) {
  const shifted = new Date(date.getTime() + tzOffsetMs(tz));
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    dow: shifted.getUTCDay(),
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Sunday 00:00 in the contest timezone, as a Date (UTC instant). */
function contestWeekStart(date = new Date(), tz = 'Asia/Manila') {
  const { y, m, d, dow } = zonedYmd(date, tz);
  const localMidnightUtc = Date.UTC(y, m, d) - tzOffsetMs(tz);
  return new Date(localMidnightUtc - dow * DAY_MS);
}

function weekStartKey(date = new Date(), tz = 'Asia/Manila') {
  const start = contestWeekStart(date, tz);
  const { y, m, d } = zonedYmd(start, tz);
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

function previousWeekStartKey(date = new Date(), tz = 'Asia/Manila') {
  const prev = new Date(contestWeekStart(date, tz).getTime() - DAY_MS);
  return weekStartKey(prev, tz);
}

function nextCrownAt(date = new Date(), tz = 'Asia/Manila') {
  return new Date(contestWeekStart(date, tz).getTime() + 7 * DAY_MS);
}

function weekEndsAt(createdAt, tz = 'Asia/Manila') {
  const start = new Date(createdAt).getTime();
  if (!Number.isFinite(start)) return null;
  return nextCrownAt(new Date(createdAt), tz);
}

function weekIsCurrent(createdAt, now = Date.now(), tz = 'Asia/Manila') {
  if (!createdAt) return false;
  const at = new Date(createdAt);
  if (Number.isNaN(at.getTime())) return false;
  return weekStartKey(at, tz) === weekStartKey(new Date(now), tz);
}

const PUBLIC_PICKS_SQL = `SELECT p.id AS pick_id, p.slot, p.caption, s.id, s.user_id, s.title,
            s.image_url, s.layout_id, s.photo_urls, s.look_json, s.spotlight_details, s.created_at, u.display_name
     FROM spotlight_picks p
     JOIN strips s ON s.id = p.strip_id
     JOIN users u ON u.id = s.user_id
     WHERE s.event_id IS NULL AND s.user_id IS NOT NULL
       AND (p.slot = 'week' OR s.spotlight_opt_in = 1)
     ORDER BY p.id ASC`;

const ENTRIES_SQL = `SELECT s.id, s.user_id, s.title, s.image_url, s.layout_id, s.photo_urls, s.look_json,
            s.spotlight_details, s.created_at, u.display_name, COUNT(l.id) AS like_count
     FROM strips s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN spotlight_likes l ON l.strip_id = s.id AND l.week_start = ?
     WHERE s.spotlight_opt_in = 1 AND s.event_id IS NULL AND s.user_id IS NOT NULL
       AND s.spotlight_week_start = ?
     GROUP BY s.id, s.user_id, s.title, s.image_url, s.layout_id, s.photo_urls, s.look_json,
              s.spotlight_details, s.created_at, u.display_name
     ORDER BY like_count DESC, s.id DESC`;

const WINNER_SQL = `SELECT l.strip_id AS id, COUNT(*) AS likes, MIN(l.created_at) AS first_like
     FROM spotlight_likes l
     INNER JOIN strips s ON s.id = l.strip_id
     WHERE l.week_start = ?
       AND s.event_id IS NULL
       AND s.user_id IS NOT NULL
     GROUP BY l.strip_id
     ORDER BY likes DESC, first_like ASC, l.strip_id ASC
     LIMIT 1`;

async function toPublicItem(row, extra = {}) {
  const mapped = await mapStripRow(row);
  const details = parseSpotlightDetails(row.spotlight_details);
  return {
    id: row.pick_id != null ? row.pick_id : row.id,
    stripId: row.id,
    slot: row.slot || null,
    imageUrl: mapped.imageUrl,
    photoUrls: mapped.photoUrls,
    layoutId: mapped.layoutId,
    title: row.title || null,
    caption: details?.quote || row.caption || null,
    credit: row.display_name || 'Customer',
    createdAt: row.created_at,
    likeCount: Number(row.like_count || extra.likeCount || 0),
    likedByMe: !!extra.likedByMe,
    details,
  };
}

async function expireStaleEntries(weekKey) {
  await pool.query(
    `UPDATE strips
     SET spotlight_opt_in = 0, spotlight_week_start = NULL
     WHERE event_id IS NULL AND spotlight_opt_in = 1
       AND (spotlight_week_start IS NULL OR spotlight_week_start < ?)`,
    [weekKey]
  );
}

async function crownWeekWinner(now = new Date()) {
  const tz = await getSpotlightTz();
  const at = now instanceof Date ? now : new Date(now);
  const weekKey = weekStartKey(at, tz);
  const [current] = await pool.query(
    "SELECT id, strip_id, created_at FROM spotlight_picks WHERE slot = 'week' ORDER BY id DESC LIMIT 1"
  );
  if (current.length && weekIsCurrent(current[0].created_at, at, tz)) {
    await expireStaleEntries(weekKey);
    return;
  }

  const prevKey = previousWeekStartKey(at, tz);
  const [standings] = await pool.query(WINNER_SQL, [prevKey]);
  const winnerId = standings[0]?.id != null ? Number(standings[0].id) : null;
  const winnerLikes = Number(standings[0]?.likes || 0);

  if (!winnerId || winnerLikes < WEEK_WIN_MIN_LIKES) {
    if (current.length) {
      await pool.query("DELETE FROM spotlight_picks WHERE slot = 'week'");
    }
    await expireStaleEntries(weekKey);
    return;
  }

  if (current.length) {
    await pool.query(
      'UPDATE spotlight_picks SET strip_id = ?, caption = NULL, created_at = ? WHERE id = ?',
      [winnerId, at, current[0].id]
    );
  } else {
    await pool.query(
      'INSERT INTO spotlight_picks (strip_id, slot, caption, created_at) VALUES (?, ?, NULL, ?)',
      [winnerId, 'week', at]
    );
  }
  const [owners] = await pool.query('SELECT user_id FROM strips WHERE id = ? LIMIT 1', [winnerId]);
  if (owners[0]?.user_id) {
    await recordPotwWin(owners[0].user_id);
  }
  await expireStaleEntries(weekKey);
}

async function expireWeekPick(now) {
  await crownWeekWinner(now);
}

async function loadPublicSpotlight(user = null, now = new Date()) {
  const tz = await getSpotlightTz();
  await crownWeekWinner(now);
  const weekKey = weekStartKey(now, tz);
  const [pickRows] = await pool.query(PUBLIC_PICKS_SQL);
  const [entryRows] = await pool.query(ENTRIES_SQL, [weekKey, weekKey]);

  let liked = new Set();
  if (user?.id) {
    const [likedRows] = await pool.query(
      'SELECT strip_id FROM spotlight_likes WHERE user_id = ? AND week_start = ?',
      [user.id, weekKey]
    );
    liked = new Set(likedRows.map((row) => Number(row.strip_id)));
  }

  const likeByStrip = new Map(entryRows.map((row) => [Number(row.id), Number(row.like_count || 0)]));
  const items = await Promise.all(
    pickRows.map((row) =>
      toPublicItem(row, {
        likeCount: likeByStrip.get(Number(row.id)) || 0,
        likedByMe: liked.has(Number(row.id)),
      })
    )
  );
  const entries = await Promise.all(
    entryRows.map((row) =>
      toPublicItem(row, {
        likeCount: Number(row.like_count || 0),
        likedByMe: liked.has(Number(row.id)),
      })
    )
  );

  const feature = items.find((item) => item.slot === 'week') || null;
  const homePicks = items.filter((item) => item.slot === 'home');
  return {
    feature,
    home: homePicks.length ? homePicks : feature ? [feature] : [],
    entries,
    week: {
      start: weekKey,
      endsAt: nextCrownAt(now, tz).toISOString(),
      tz,
      winMinLikes: WEEK_WIN_MIN_LIKES,
    },
  };
}

async function loadAdminStandings(now = new Date()) {
  const tz = await getSpotlightTz();
  const weekKey = weekStartKey(now, tz);
  const [rows] = await pool.query(ENTRIES_SQL, [weekKey, weekKey]);
  return rows.map((row) => ({
    stripId: row.id,
    title: row.title || null,
    credit: row.display_name || 'Customer',
    likes: Number(row.like_count || 0),
  }));
}

module.exports = {
  HOME_LIMIT,
  WEEK_WIN_MIN_LIKES,
  PUBLIC_PICKS_SQL,
  ENTRIES_SQL,
  WINNER_SQL,
  loadPublicSpotlight,
  loadAdminStandings,
  expireWeekPick,
  crownWeekWinner,
  contestWeekStart,
  weekStartKey,
  previousWeekStartKey,
  nextCrownAt,
  weekEndsAt,
  weekIsCurrent,
  getSpotlightTz,
};
