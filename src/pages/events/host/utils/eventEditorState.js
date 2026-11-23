import { resolveLayoutId } from '../../../../data/stripLayouts';
import { isCssOnlyBackground } from '../../../../data/editorBackgrounds';
import { getDefaultDatePosition } from '../../../../utils/stripCompositor';
import { normalizeDatePlacement } from '../../../../components/DateStampControls';

export { loadEditorState, saveEditorState, clearEditorSession } from '../../../../utils/eventSession';

export const DEFAULT_STRIP_BG = '#000000';
export const DEFAULT_STRIP_BORDER = '#000000';

export function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function normalizeStripStyle(value, fallback = DEFAULT_STRIP_BG) {
  if (!value || value === 'linear-gradient(135deg, #f0e8ff, #e8d5ff)') return fallback;
  return value;
}

export function normalizeStripBorder(value) {
  if (!value || value === '#ffffff') return DEFAULT_STRIP_BORDER;
  return value;
}

export function resolveSavedDatePosition(saved, layoutId) {
  if (typeof saved?.dateX === 'number' && typeof saved?.dateY === 'number') {
    return { x: saved.dateX, y: saved.dateY };
  }
  const placement = normalizeDatePlacement(saved?.datePlacement ?? saved?.datePosition);
  return getDefaultDatePosition(layoutId, {
    placement,
    dateSize: saved?.dateSize || 12,
  });
}

export function photosFromUrls(urls, stripId) {
  return (urls || []).map((src, index) => ({
    id: `${stripId}-${index}`,
    src,
    filter: 'none',
    frame: null,
  }));
}

export function lookFromFields(fields) {
  return {
    customBg: fields.customBg,
    customBorder: fields.customBorder,
    showDate: fields.showDate,
    dateSize: fields.dateSize,
    dateColor: fields.dateColor,
    dateX: fields.dateX,
    dateY: fields.dateY,
    dateFont: fields.dateFont,
  };
}

export function saveStatusLabel(saveStatus, isHostEditor) {
  if (saveStatus === 'updating') return 'Updating…';
  if (saveStatus === 'applying') return 'Applying look to all photos…';
  if (saveStatus === 'saved') {
    return isHostEditor ? 'Look saved on every guest photo' : 'Saved to this event';
  }
  if (saveStatus === 'error') return 'Couldn’t update';
  return '';
}

export function initialEditorLayout({ captureOnly, navLayout, saved }) {
  return captureOnly ? 3 : resolveLayoutId(navLayout || saved?.layout || 1);
}

export function shouldSkipInitialRegen({ fromBooth, captureOnly, saved }) {
  return (
    !(fromBooth || captureOnly)
    && Boolean(saved?.stripImageData)
    && !isCssOnlyBackground(normalizeStripStyle(saved?.customBg))
  );
}
