import { resolveLayoutId } from '../data/stripLayouts';
import { apiRequest, patchHostStrip } from './api';
import { dataUrlToFile } from './dataUrlFile';
import { getDefaultDatePosition, renderStripToCanvas } from './stripCompositor';

function dist2(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

export function inferDatePlacement(look, sourceLayoutId) {
  if (!look || typeof look.dateX !== 'number' || typeof look.dateY !== 'number' || !sourceLayoutId) {
    return 'belowPhotos';
  }
  const size = look.dateSize || 12;
  const below = getDefaultDatePosition(sourceLayoutId, { placement: 'belowPhotos', dateSize: size });
  const footer = getDefaultDatePosition(sourceLayoutId, { placement: 'footerBar', dateSize: size });
  return dist2({ x: look.dateX, y: look.dateY }, footer) < dist2({ x: look.dateX, y: look.dateY }, below)
    ? 'footerBar'
    : 'belowPhotos';
}

/** Colors/fonts copy everywhere. Date x/y stay on the edited layout; other layouts get that layout’s default. */
export function lookForLayout(look, targetLayoutId, sourceLayoutId) {
  if (!look) return look;
  const layoutId = targetLayoutId != null ? resolveLayoutId(targetLayoutId) : null;
  const sourceId = sourceLayoutId != null ? resolveLayoutId(sourceLayoutId) : null;
  if (!layoutId || layoutId === sourceId) return look;
  const pos = getDefaultDatePosition(layoutId, {
    placement: inferDatePlacement(look, sourceId),
    dateSize: look.dateSize || 12,
  });
  return { ...look, dateX: pos.x, dateY: pos.y };
}

export async function fetchAllEventStrips(eventId) {
  const strips = [];
  let before = null;
  for (;;) {
    const query = new URLSearchParams({ limit: '100' });
    if (before) query.set('before', String(before));
    const data = await apiRequest(`/api/events/${eventId}/strips?${query}`);
    const page = data.strips || [];
    strips.push(...page);
    if (!data.hasMore || !page.length) break;
    before = data.nextCursor || page[page.length - 1].id;
  }
  return strips;
}

export async function applyLookToEventStrips({
  eventId,
  look,
  skipStripId,
  sourceLayoutId,
} = {}) {
  if (!eventId || !look) return;
  const strips = await fetchAllEventStrips(eventId);
  for (const item of strips) {
    if (Number(item.id) === Number(skipStripId)) continue;
    const urls = item.photoUrls || [];
    const layoutId = item.layoutId != null ? resolveLayoutId(item.layoutId) : null;
    const mappedLook = lookForLayout(look, layoutId, sourceLayoutId);
    if (!urls.length || !layoutId) {
      await patchHostStrip(eventId, item.id, { look: mappedLook });
      continue;
    }
    const photos = urls.map((src, index) => ({
      id: `${item.id}-${index}`,
      src,
      filter: 'none',
      frame: null,
    }));
    const dataUrl = await renderStripToCanvas({
      layoutId,
      photos,
      customBg: mappedLook.customBg,
      customBorder: mappedLook.customBorder,
      showDate: mappedLook.showDate,
      dateSize: mappedLook.dateSize,
      dateColor: mappedLook.dateColor,
      dateX: mappedLook.dateX,
      dateY: mappedLook.dateY,
      dateFont: mappedLook.dateFont,
    });
    const previewFile = dataUrl
      ? await dataUrlToFile(dataUrl, `event-strip-${item.id}.png`)
      : null;
    await patchHostStrip(eventId, item.id, { look: mappedLook, previewFile });
  }
}
