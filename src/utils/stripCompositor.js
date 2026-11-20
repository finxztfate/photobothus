import {
  computeStripDimensions,
  getDarkPlacements,
  getPhotoPlacements,
} from '../data/filterTemplates';
import { STRIP_PADDING } from '../data/stripLayouts';
import { drawRetroFrame, ensureRetroFrameFonts } from './retroFrames';

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function drawImageCover(ctx, image, x, y, width, height, zoom = 1) {
  if (!image?.width || !image?.height) return;

  const imageAspect = image.width / image.height;
  const frameAspect = width / height;

  let sx;
  let sy;
  let sw;
  let sh;

  if (imageAspect > frameAspect) {
    sh = image.height;
    sw = sh * frameAspect;
    sx = (image.width - sw) / 2;
    sy = 0;
  } else {
    sw = image.width;
    sh = sw / frameAspect;
    sx = 0;
    sy = (image.height - sh) / 2;
  }

  const drawWidth = width * zoom;
  const drawHeight = height * zoom;
  const drawX = x - (drawWidth - width) / 2;
  const drawY = y - (drawHeight - height) / 2;

  ctx.drawImage(image, sx, sy, sw, sh, drawX, drawY, drawWidth, drawHeight);
}

function fillBackground(ctx, customBg, stripWidth, stripHeight) {
  if (typeof customBg === 'string' && (customBg.startsWith('/') || customBg.startsWith('data:image'))) {
    return loadImage(customBg).then((bgImage) => {
      if (bgImage) {
        drawImageCover(ctx, bgImage, 0, 0, stripWidth, stripHeight);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, stripWidth, stripHeight);
      }
    });
  }

  const bgGradient = (() => {
    const match = String(customBg).match(/linear-gradient\(\s*(\d+)deg,\s*([^)]+)\)/);
    if (match) {
      const angle = parseInt(match[1], 10);
      const parts = match[2].split(',').map((c) => c.trim()).filter(Boolean);
      const color1 = parts[0] || '#ffffff';
      const color2 = parts[parts.length - 1] || '#ffffff';
      const x1 = stripWidth / 2 - Math.cos((angle * Math.PI) / 180) * stripWidth;
      const y1 = stripHeight / 2 - Math.sin((angle * Math.PI) / 180) * stripHeight;
      const x2 = stripWidth / 2 + Math.cos((angle * Math.PI) / 180) * stripWidth;
      const y2 = stripHeight / 2 + Math.sin((angle * Math.PI) / 180) * stripHeight;
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, color1);
      grad.addColorStop(1, color2);
      return grad;
    }
    return customBg;
  })();

  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, stripWidth, stripHeight);
  return Promise.resolve();
}

function getBottomDarkRect(darkRects) {
  if (!darkRects.length) return null;
  return darkRects.reduce((bottom, rect) => (
    rect.y + rect.h > bottom.y + bottom.h ? rect : bottom
  ));
}

async function ensureFontLoaded(fontFamily, size = 12) {
  if (!fontFamily || !document.fonts?.load) return;
  try {
    await document.fonts.load(`${size}px ${fontFamily}`);
  } catch {
    // Fall back to system fonts if a web font fails to load.
  }
}

const BRAND_TEXT = 'PHOTOBOOTH.US';
const BRAND_FONT = '"Krona One", "Fredoka", sans-serif';

function hexLuminance(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const n = parseInt(match[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function isLightBackground(customBg) {
  if (typeof customBg !== 'string' || customBg.startsWith('/')) return false;
  const hexes = customBg.match(/#[0-9a-f]{6}/gi) || [];
  const values = hexes.map(hexLuminance).filter((v) => v !== null);
  if (!values.length) return false;
  return values.reduce((sum, v) => sum + v, 0) / values.length > 0.6;
}

async function drawBrand(ctx, darkRect, customBg, stripHeight) {
  if (!darkRect) return;
  const maxWidth = darkRect.w * 0.8;
  let fontSize = Math.min(darkRect.w * 0.055, darkRect.h * 0.28);
  await ensureFontLoaded(BRAND_FONT, fontSize);

  ctx.save();
  ctx.font = `${fontSize}px ${BRAND_FONT}`;
  const measured = ctx.measureText(BRAND_TEXT).width;
  if (measured > maxWidth) {
    fontSize *= maxWidth / measured;
    ctx.font = `${fontSize}px ${BRAND_FONT}`;
  }

  const light = isLightBackground(customBg);
  ctx.fillStyle = light ? '#16120C' : '#ffffff';
  if (!light) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = fontSize * 0.3;
  }
  const gap = fontSize * 0.3;
  const rectBottom = darkRect.y + darkRect.h;
  const touchesStripBottom = stripHeight - rectBottom <= STRIP_PADDING.bottom + 1;
  const bottom = (touchesStripBottom ? stripHeight : rectBottom) - gap;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(BRAND_TEXT, darkRect.x + gap, bottom);
  ctx.restore();
}

export function getDateStampText(date = new Date()) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}.${date.getFullYear()}`;
}

/** Default normalized center (0–1) for the date stamp from a legacy placement preset. */
export function getDefaultDatePosition(layoutId, { placement = 'belowPhotos', dateSize = 12 } = {}) {
  const { padding, stripWidth, stripHeight } = computeStripDimensions(layoutId);
  const placementOptions = {
    paddingTop: padding.top,
    paddingRight: padding.side,
    paddingBottom: padding.bottom,
    paddingLeft: padding.side,
    gap: 2,
  };

  const darkRects = getDarkPlacements(layoutId, stripWidth, stripHeight, placementOptions);
  const placements = getPhotoPlacements(layoutId, stripWidth, stripHeight, placementOptions);
  const bottomDark = getBottomDarkRect(darkRects);

  let x = stripWidth / 2;
  let y = stripHeight - padding.bottom / 2;

  const preset = placement === 'bottom' || placement === 'footerBar' ? 'footerBar' : 'belowPhotos';

  if (preset === 'footerBar' && bottomDark) {
    x = bottomDark.x + bottomDark.w / 2;
    y = bottomDark.y + bottomDark.h / 2;
  } else if (preset === 'belowPhotos' && placements.length > 0) {
    const lastPhoto = placements[placements.length - 1];
    y = lastPhoto.y + lastPhoto.h + dateSize;
  }

  return {
    x: x / stripWidth,
    y: y / stripHeight,
  };
}

function resolveDateCoordinates({
  layoutId,
  stripWidth,
  stripHeight,
  datePlacement,
  datePosition,
  dateX,
  dateY,
  dateSize,
}) {
  if (typeof dateX === 'number' && typeof dateY === 'number') {
    return {
      x: dateX * stripWidth,
      y: dateY * stripHeight,
    };
  }

  const { padding } = computeStripDimensions(layoutId);
  const placementOptions = {
    paddingTop: padding.top,
    paddingRight: padding.side,
    paddingBottom: padding.bottom,
    paddingLeft: padding.side,
    gap: 2,
  };
  const darkRects = getDarkPlacements(layoutId, stripWidth, stripHeight, placementOptions);
  const placements = getPhotoPlacements(layoutId, stripWidth, stripHeight, placementOptions);
  const bottomDark = getBottomDarkRect(darkRects);

  const preset = (() => {
    const raw = datePlacement ?? datePosition ?? 'belowPhotos';
    if (raw === 'under' || raw === 'belowPhotos') return 'belowPhotos';
    if (raw === 'bottom' || raw === 'footerBar') return 'footerBar';
    return 'belowPhotos';
  })();

  let x = stripWidth / 2;
  let y = stripHeight - padding.bottom / 2;

  if (preset === 'footerBar' && bottomDark) {
    x = bottomDark.x + bottomDark.w / 2;
    y = bottomDark.y + bottomDark.h / 2;
  } else if (preset === 'belowPhotos' && placements.length > 0) {
    const lastPhoto = placements[placements.length - 1];
    y = lastPhoto.y + lastPhoto.h + dateSize;
  }

  return { x, y };
}

export async function renderStripToCanvas({
  layoutId,
  photos = [],
  customBg = '#000000',
  customBorder = '#000000',
  showDate = false,
  dateSize = 12,
  dateColor = '#E8A33D',
  datePlacement,
  dateFont = '"Special Elite", cursive',
  datePosition,
  dateX,
  dateY,
  omitBackground = false,
}) {
  const { padding, stripWidth, stripHeight } = computeStripDimensions(layoutId);

  const canvas = document.createElement('canvas');
  canvas.width = stripWidth;
  canvas.height = stripHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  if (omitBackground) {
    ctx.clearRect(0, 0, stripWidth, stripHeight);
  } else {
    await fillBackground(ctx, customBg, stripWidth, stripHeight);
  }

  const placementOptions = {
    paddingTop: padding.top,
    paddingRight: padding.side,
    paddingBottom: padding.bottom,
    paddingLeft: padding.side,
    gap: 2,
  };

  const loaded = await Promise.all(
    photos.map(async (photo) => ({ photo, img: await loadImage(photo.src) }))
  );
  const drawable = loaded.filter(({ img }) => img);
  if (!drawable.length) throw new Error('No images loaded');
  if (drawable.some(({ photo }) => photo.frame)) await ensureRetroFrameFonts();

  const placements = getPhotoPlacements(layoutId, stripWidth, stripHeight, placementOptions);
  drawable.forEach(({ photo, img }, idx) => {
    const slot = placements[idx];
    if (!slot) return;
    const { x, y, w, h } = slot;
    drawImageCover(ctx, img, x, y, w, h);
    if (photo.frame) drawRetroFrame(ctx, photo.frame, slot, { index: idx });
    if (customBorder && customBorder !== '#000000' && customBorder !== customBg) {
      ctx.strokeStyle = customBorder;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    }
  });

  const isCustomArtwork = typeof customBg === 'string' && customBg.startsWith('data:image');
  if (!isCustomArtwork) {
    const darkRects = getDarkPlacements(layoutId, stripWidth, stripHeight, placementOptions);
    const brandRect = darkRects.reduce(
      (largest, rect) => (!largest || rect.w * rect.h > largest.w * largest.h ? rect : largest),
      null
    );
    await drawBrand(ctx, brandRect, customBg, stripHeight);
  }

  if (showDate) {
    await ensureFontLoaded(dateFont, dateSize);

    const dateText = getDateStampText();
    ctx.font = `${dateSize}px ${dateFont}`;
    ctx.fillStyle = dateColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const { x: dateXpx, y: dateYpx } = resolveDateCoordinates({
      layoutId,
      stripWidth,
      stripHeight,
      datePlacement,
      datePosition,
      dateX,
      dateY,
      dateSize,
    });

    ctx.fillText(dateText, dateXpx, dateYpx);
  }

  return canvas.toDataURL('image/png');
}
