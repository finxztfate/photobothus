const { pool } = require('../db');
const { mapStripRow } = require('./stripHelpers');
const { parseSpotlightDetails } = require('./spotlightDetails');

const HOME_LIMIT = 3;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function weekEndsAt(createdAt) {
  const start = new Date(createdAt).getTime();
  if (!Number.isFinite(start)) return null;
  return new Date(start + WEEK_MS);
}

function weekIsCurrent(createdAt, now = Date.now()) {
  const ends = weekEndsAt(createdAt);
  return !!ends && ends.getTime() > now;
}

/** A photo of the week leaves Spotlight once its seven days are up. */
async function expireWeekPick() {
  await pool.query(
    "DELETE FROM spotlight_picks WHERE slot = 'week' AND created_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)"
  );
}

const PUBLIC_PICKS_SQL = `SELECT p.id AS pick_id, p.slot, p.caption, s.id, s.user_id, s.title,
            s.image_url, s.spotlight_details, s.created_at, u.display_name
     FROM spotlight_picks p
     JOIN strips s ON s.id = p.strip_id
     JOIN users u ON u.id = s.user_id
     WHERE s.spotlight_opt_in = 1 AND s.event_id IS NULL AND s.user_id IS NOT NULL
     ORDER BY p.id ASC`;

async function toPublicItem(row) {
  const mapped = await mapStripRow(row);
  const details = parseSpotlightDetails(row.spotlight_details);
  return {
    id: row.pick_id,
    stripId: row.id,
    slot: row.slot,
    imageUrl: mapped.imageUrl,
    title: row.title || null,
    caption: details?.quote || row.caption || null,
    credit: row.display_name || 'Customer',
    createdAt: row.created_at,
    details,
  };
}

/** Picks whose owner has turned the permission back off are left out. */
async function loadPublicSpotlight() {
  await expireWeekPick();
  const [rows] = await pool.query(PUBLIC_PICKS_SQL);
  const items = await Promise.all(rows.map(toPublicItem));
  const feature = items.find((item) => item.slot === 'week') || null;
  const homePicks = items.filter((item) => item.slot === 'home');
  return {
    feature,
    home: homePicks.length ? homePicks : feature ? [feature] : [],
  };
}

module.exports = {
  HOME_LIMIT,
  PUBLIC_PICKS_SQL,
  loadPublicSpotlight,
  expireWeekPick,
  weekEndsAt,
  weekIsCurrent,
};
