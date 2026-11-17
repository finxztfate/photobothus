import { getBoothCaptureAspect } from '../data/stripLayouts';

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Capture the full camera frame at native video resolution (photobooth-io style).
 * Filter and optional AR overlay are baked into the output image.
 */
export async function captureNativeFrame(
  videoEl,
  {
    filterCss = 'none',
    mirrored = false,
    overlayCanvas = null,
    settleMs = 100,
    mimeType = 'image/png',
    quality = 0.95,
  } = {}
) {
  if (!videoEl) return null;

  const sourceWidth = videoEl.videoWidth;
  const sourceHeight = videoEl.videoHeight;
  if (!sourceWidth || !sourceHeight) return null;

  const canvas = document.createElement('canvas');
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (mirrored) {
    ctx.save();
    ctx.translate(sourceWidth, 0);
    ctx.scale(-1, 1);
  }

  ctx.filter = filterCss && filterCss !== 'none' ? filterCss : 'none';
  ctx.drawImage(videoEl, 0, 0, sourceWidth, sourceHeight);

  if (mirrored) {
    ctx.restore();
  }

  if (overlayCanvas?.width && overlayCanvas?.height) {
    ctx.filter = 'none';
    ctx.drawImage(overlayCanvas, 0, 0, sourceWidth, sourceHeight);
  }

  if (settleMs > 0) await delay(settleMs);

  if (mimeType === 'image/png') {
    return canvas.toDataURL('image/png');
  }
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Capture at booth aspect with center crop — matches the booth preview (object-fit: cover).
 */
export async function captureBoothFrame(
  videoEl,
  {
    aspect = getBoothCaptureAspect(),
    filterCss = 'none',
    mirrored = false,
    overlayCanvas = null,
    settleMs = 100,
    minWidth = 1280,
    maxWidth = 1920,
    mimeType = 'image/png',
    quality = 0.95,
  } = {}
) {
  if (!videoEl) return null;

  const sourceWidth = videoEl.videoWidth;
  const sourceHeight = videoEl.videoHeight;
  if (!sourceWidth || !sourceHeight) return null;

  const outputWidth = Math.min(Math.max(sourceWidth, minWidth), maxWidth);
  const outputHeight = Math.round(outputWidth / aspect);

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const sourceAspect = sourceWidth / sourceHeight;
  let sx;
  let sy;
  let sw;
  let sh;

  if (sourceAspect > aspect) {
    sh = sourceHeight;
    sw = sh * aspect;
    sx = (sourceWidth - sw) / 2;
    sy = 0;
  } else {
    sw = sourceWidth;
    sh = sw / aspect;
    sx = 0;
    sy = (sourceHeight - sh) / 2;
  }

  if (mirrored) {
    ctx.translate(outputWidth, 0);
    ctx.scale(-1, 1);
  }

  ctx.filter = filterCss && filterCss !== 'none' ? filterCss : 'none';
  ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);

  if (mirrored) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  if (overlayCanvas?.width && overlayCanvas?.height) {
    ctx.filter = 'none';
    ctx.drawImage(overlayCanvas, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);
  }

  if (settleMs > 0) await delay(settleMs);

  if (mimeType === 'image/png') {
    return canvas.toDataURL('image/png');
  }
  return canvas.toDataURL('image/jpeg', quality);
}

/** Load an image and bake the booth filter + 4:3 crop (same as camera capture). */
export async function applyBoothFilterToImageSrc(
  src,
  {
    aspect = getBoothCaptureAspect(),
    filterCss = 'none',
    minWidth = 1280,
    maxWidth = 1920,
    mimeType = 'image/png',
    quality = 0.95,
  } = {}
) {
  if (!src) return null;

  const image = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

  if (!image?.width || !image?.height) return null;

  const outputWidth = Math.min(Math.max(image.width, minWidth), maxWidth);
  const outputHeight = Math.round(outputWidth / aspect);

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const sourceAspect = image.width / image.height;
  let sx;
  let sy;
  let sw;
  let sh;

  if (sourceAspect > aspect) {
    sh = image.height;
    sw = sh * aspect;
    sx = (image.width - sw) / 2;
    sy = 0;
  } else {
    sw = image.width;
    sh = sw / aspect;
    sx = 0;
    sy = (image.height - sh) / 2;
  }

  ctx.filter = filterCss && filterCss !== 'none' ? filterCss : 'none';
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);

  if (mimeType === 'image/png') {
    return canvas.toDataURL('image/png');
  }
  return canvas.toDataURL('image/jpeg', quality);
}

/** Capture size matching a visible preview element (WYSIWYG with object-fit: cover crop). */
export function getCaptureSizeFromPreview(previewEl, minWidth = 1280) {
  const cw = previewEl?.clientWidth || 0;
  const ch = previewEl?.clientHeight || 0;
  if (!cw || !ch) return null;

  const aspect = cw / ch;
  const width = Math.min(Math.max(cw, minWidth), 1920);
  const height = Math.round(width / aspect);
  return { width, height, aspect };
}

/** High-res capture size cropped to the uniform booth preview frame. */
export function getCaptureSizeForLayout(_layoutId, videoEl, minWidth = 1280) {
  const aspect = getBoothCaptureAspect();
  const nativeW = videoEl?.videoWidth || minWidth;
  const width = Math.min(Math.max(nativeW, minWidth), 1920);
  const height = Math.round(width / aspect);
  return { width, height, aspect };
}
