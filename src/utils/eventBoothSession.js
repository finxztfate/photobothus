import { getEventGuestKey, uploadEventSession } from './api';
import { dataUrlToFile } from './dataUrlFile';
import { renderStripToCanvas } from './stripCompositor';

async function previewFileForLayout(layoutId, photos, fallbackFile) {
  try {
    const stripDataUrl = await renderStripToCanvas({
      layoutId,
      photos,
      customBg: '#000000',
      customBorder: '#000000',
      showDate: false,
    });
    if (stripDataUrl) {
      return dataUrlToFile(stripDataUrl, 'event-strip.png');
    }
  } catch {
    /* keep the first photo if the layout composite fails */
  }
  return fallbackFile;
}

/** Upload one guest booth run: cell photos plus a laid-out strip preview. */
export async function saveEventBoothSession({ code, layoutId, photos }) {
  const photoFiles = await Promise.all(
    photos.map((photo, index) => dataUrlToFile(photo.src, `event-photo-${index + 1}.png`))
  );
  const previewFile = await previewFileForLayout(layoutId, photos, photoFiles[0]);
  return uploadEventSession(code, {
    guestKey: getEventGuestKey(code),
    title: 'Event strip',
    layoutId,
    previewFile,
    photoFiles,
  });
}
