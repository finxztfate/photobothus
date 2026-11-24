import { STRIP_LAYOUTS, getLayoutById } from '../data/stripLayouts';
import { DEFAULT_MAX_EVENT_UPLOADS } from '../data/eventLimits';

/** Must match server/src/utils/eventLayouts.js — admin limit assumes a 4-photo strip. */
export const BASE_LAYOUT_PHOTO_COUNT = 4;
const BASE_FILES_PER_STRIP = BASE_LAYOUT_PHOTO_COUNT + 1;

export function allLayoutIds() {
  return STRIP_LAYOUTS.map((layout) => layout.id);
}

export function normalizeAllowedLayoutIds(ids) {
  if (!Array.isArray(ids) || !ids.length) return allLayoutIds();
  const valid = new Set(allLayoutIds());
  const next = [...new Set(ids.map(Number).filter((id) => valid.has(id)))];
  return next.length ? next.sort((a, b) => a - b) : allLayoutIds();
}

/** Guest booth filter: null/empty from API means all layouts; otherwise only those ids. */
export function layoutsAllowedForGuest(allowedLayouts) {
  if (!Array.isArray(allowedLayouts) || !allowedLayouts.length) {
    return STRIP_LAYOUTS;
  }
  const allowed = new Set(
    allowedLayouts.map(Number).filter((id) => Number.isInteger(id) && id > 0)
  );
  const filtered = STRIP_LAYOUTS.filter((layout) => allowed.has(layout.id));
  return filtered.length ? filtered : STRIP_LAYOUTS;
}

export function maxPhotoCountForLayoutIds(layoutIds) {
  const ids = normalizeAllowedLayoutIds(layoutIds);
  return Math.max(
    ...ids.map((id) => getLayoutById(id)?.photoCount || BASE_LAYOUT_PHOTO_COUNT)
  );
}

/** Safe strip capacity for the heaviest allowed layout, relative to the admin budget. */
export function estimateEventStripLimit(adminMax, layoutIds, { treatAllAsUnset = false } = {}) {
  const base = Math.max(1, Number(adminMax) || DEFAULT_MAX_EVENT_UPLOADS);
  const ids = Array.isArray(layoutIds) ? layoutIds : [];
  const all = allLayoutIds();
  const isAll =
    treatAllAsUnset &&
    ids.length === all.length &&
    all.every((id) => ids.includes(id));
  if (!ids.length || isAll) return base;
  const filesPerStrip = maxPhotoCountForLayoutIds(ids) + 1;
  return Math.max(1, Math.floor((base * BASE_FILES_PER_STRIP) / filesPerStrip));
}

/** null means “all layouts” for the API (legacy events behave the same). */
export function serializeAllowedLayoutsForApi(layoutIds) {
  const ids = normalizeAllowedLayoutIds(layoutIds);
  const all = allLayoutIds();
  if (ids.length === all.length && all.every((id) => ids.includes(id))) {
    return null;
  }
  return ids;
}

export function layoutCapacitySummary(adminMax, layoutIds) {
  const ids = normalizeAllowedLayoutIds(layoutIds);
  const all = allLayoutIds();
  const isAllSelected = ids.length === all.length && all.every((id) => ids.includes(id));
  const maxPhotos = maxPhotoCountForLayoutIds(ids);
  const filesPerStrip = maxPhotos + 1;
  const suggestedLimit = estimateEventStripLimit(adminMax, ids, { treatAllAsUnset: true });
  const polaroidOnlyLimit = estimateEventStripLimit(adminMax, [3]);
  const heaviest = ids
    .map((id) => getLayoutById(id))
    .filter(Boolean)
    .sort((a, b) => b.photoCount - a.photoCount)[0];

  return {
    layoutIds: ids,
    isAllSelected,
    maxPhotos,
    filesPerStrip,
    suggestedLimit,
    polaroidOnlyLimit,
    heaviestName: heaviest?.name || 'selected layout',
    heaviestPhotoCount: heaviest?.photoCount || maxPhotos,
  };
}
