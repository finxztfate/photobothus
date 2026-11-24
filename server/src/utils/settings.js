const { pool } = require('../db');

const DEFAULTS = {
  max_guest_uploads: '2',
  max_event_uploads: '30',
  event_creation_enabled: '1',
  image_access_ttl_hours: '24',
  spotlight_tz: 'Asia/Manila',
};

const MAX_EVENT_UPLOADS_CEILING = 10000;

let cache = null;
let cacheAt = 0;
const CACHE_MS = 5000;

async function ensureDefaults() {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await pool.query(
      `INSERT INTO app_settings (setting_key, setting_value)
       SELECT ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE setting_key = ?)`,
      [key, value, key]
    );
  }
}

async function loadAllSettings() {
  if (cache && Date.now() - cacheAt < CACHE_MS) {
    return cache;
  }

  try {
    const [rows] = await pool.query('SELECT setting_key, setting_value FROM app_settings');
    const map = { ...DEFAULTS };
    rows.forEach((row) => {
      map[row.setting_key] = row.setting_value;
    });
    cache = map;
    cacheAt = Date.now();
    return map;
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return { ...DEFAULTS };
    }
    throw err;
  }
}

function invalidateSettingsCache() {
  cache = null;
  cacheAt = 0;
}

async function getSetting(key) {
  const all = await loadAllSettings();
  return all[key] ?? DEFAULTS[key] ?? null;
}

async function getMaxGuestUploads() {
  const raw = await getSetting('max_guest_uploads');
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 10;
  return Math.min(100, Math.floor(n));
}

// Total photos one event can hold, across every guest. Unlike the per-guest
// limit this does not depend on anything the guest's browser sends.
async function getMaxEventUploads() {
  const raw = await getSetting('max_event_uploads');
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return Number(DEFAULTS.max_event_uploads);
  return Math.min(MAX_EVENT_UPLOADS_CEILING, Math.floor(n));
}

function settingIsOn(raw, fallback = true) {
  if (raw == null || raw === '') return fallback;
  const value = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  return fallback;
}

async function isEventCreationEnabled() {
  return settingIsOn(await getSetting('event_creation_enabled'), true);
}

async function getImageAccessTtlHours() {
  const raw = await getSetting('image_access_ttl_hours');
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 24;
  return Math.min(168, Math.floor(n));
}

async function getSpotlightTz() {
  return (await getSetting('spotlight_tz')) || 'Asia/Manila';
}

async function setSettings(updates) {
  const allowed = Object.keys(DEFAULTS);
  for (const [key, value] of Object.entries(updates)) {
    if (!allowed.includes(key)) continue;
    await pool.query(
      `INSERT INTO app_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, String(value)]
    );
  }
  invalidateSettingsCache();
  return loadAllSettings();
}

module.exports = {
  DEFAULTS,
  ensureDefaults,
  loadAllSettings,
  getSetting,
  getMaxGuestUploads,
  getMaxEventUploads,
  MAX_EVENT_UPLOADS_CEILING,
  isEventCreationEnabled,
  getImageAccessTtlHours,
  getSpotlightTz,
  setSettings,
  invalidateSettingsCache,
};
