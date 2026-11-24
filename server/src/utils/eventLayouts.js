// Keep photo counts in sync with src/data/stripLayouts.js.
const LAYOUT_PHOTO_COUNTS = {
  1: 4,
  2: 4,
  3: 1,
  4: 2,
  5: 1,
  6: 3,
  7: 4,
  8: 3,
  9: 6,
  10: 4,
  11: 3,
};

const VALID_LAYOUT_IDS = Object.keys(LAYOUT_PHOTO_COUNTS).map(Number);

/** Admin max_event_uploads is calibrated for a typical 4-photo strip (+ preview). */
const BASE_PHOTO_COUNT = 4;
const BASE_FILES_PER_STRIP = BASE_PHOTO_COUNT + 1;

function photoCountForLayout(layoutId) {
  return LAYOUT_PHOTO_COUNTS[Number(layoutId)] || BASE_PHOTO_COUNT;
}

function parseAllowedLayouts(value) {
  if (value == null || value === '') return null;
  let raw = value;
  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(raw)) return null;
  const ids = [...new Set(
    raw
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && VALID_LAYOUT_IDS.includes(id))
  )].sort((a, b) => a - b);
  return ids.length ? ids : null;
}

function serializeAllowedLayouts(ids) {
  const parsed = parseAllowedLayouts(ids);
  return parsed ? JSON.stringify(parsed) : null;
}

function readAllowedLayouts(body, fallback = null) {
  if (body.allowedLayouts === undefined) {
    return parseAllowedLayouts(fallback);
  }
  if (body.allowedLayouts == null || body.allowedLayouts === '') {
    return null;
  }
  const parsed = parseAllowedLayouts(body.allowedLayouts);
  if (!parsed) {
    const error = new Error('Choose at least one valid strip layout');
    error.status = 400;
    throw error;
  }
  return parsed;
}

function maxPhotoCountForLayouts(allowedIds) {
  const ids = allowedIds?.length ? allowedIds : VALID_LAYOUT_IDS;
  return Math.max(...ids.map(photoCountForLayout));
}

/**
 * Heavier layouts use more files per strip, so fewer strips fit the same
 * storage budget. Lighter layouts (e.g. Polaroid) raise the safe strip count.
 * When layouts are unset (all allowed), keep the admin budget as configured.
 */
function estimateEventStripLimit(adminMax, allowedIds) {
  const base = Math.max(1, Number(adminMax) || 30);
  if (!allowedIds?.length) return base;
  const maxPhotos = maxPhotoCountForLayouts(allowedIds);
  const filesPerStrip = maxPhotos + 1;
  return Math.max(1, Math.floor((base * BASE_FILES_PER_STRIP) / filesPerStrip));
}

function isLayoutAllowed(allowedIds, layoutId) {
  if (!allowedIds?.length) return true;
  return allowedIds.includes(Number(layoutId));
}

module.exports = {
  LAYOUT_PHOTO_COUNTS,
  VALID_LAYOUT_IDS,
  BASE_PHOTO_COUNT,
  BASE_FILES_PER_STRIP,
  parseAllowedLayouts,
  serializeAllowedLayouts,
  readAllowedLayouts,
  photoCountForLayout,
  maxPhotoCountForLayouts,
  estimateEventStripLimit,
  isLayoutAllowed,
};
