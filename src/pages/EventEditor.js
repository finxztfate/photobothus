import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { resolveLayoutId, getLayoutById } from '../data/stripLayouts';
import { bgColorPresets, buildCustomGradient, getBackgroundPreviewStyle, isCssOnlyBackground } from '../data/editorBackgrounds';
import { renderStripToCanvas, drawImageCover, getDefaultDatePosition, isLightBackground } from '../utils/stripCompositor';
import { customization } from '../utils/customization';
import { uploadStrip, getEventGuestKey, apiRequest } from '../utils/api';
import { trackDataAction } from '../utils/loadingBus';
import BackgroundStripPicker from '../components/BackgroundStripPicker';
import DateStampControls, { normalizeDatePlacement, DEFAULT_DATE_FONT } from '../components/DateStampControls';
import DraggableStripPreview from '../components/DraggableStripPreview';
import './Home.css';
import './EventEditor.css';

function loadEditorState() {
  try {
    return JSON.parse(sessionStorage.getItem('eventEditorState'));
  } catch {
    return null;
  }
}

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function dataUrlToFile(dataUrl, filename) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: 'image/png' });
}

function normalizeStripStyle(value, fallback = '#000000') {
  if (!value || value === 'linear-gradient(135deg, #f0e8ff, #e8d5ff)') return fallback;
  return value;
}

function normalizeStripBorder(value) {
  if (!value || value === '#ffffff') return '#000000';
  return value;
}

function resolveSavedDatePosition(saved, layoutId) {
  if (typeof saved?.dateX === 'number' && typeof saved?.dateY === 'number') {
    return { x: saved.dateX, y: saved.dateY };
  }

  const placement = normalizeDatePlacement(saved?.datePlacement ?? saved?.datePosition);
  return getDefaultDatePosition(layoutId, {
    placement,
    dateSize: saved?.dateSize || 12,
  });
}

function EventEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { code: eventCode } = useParams();
  const saved = loadEditorState();
  const navPhotos = location.state?.photos;
  const navLayout = location.state?.layout;
  const fromBooth = Array.isArray(navPhotos) && navPhotos.length > 0;
  const captureOnly = !!(
    location.state?.captureOnly ||
    location.state?.stripsEnabled === false ||
    saved?.captureOnly ||
    saved?.stripsEnabled === false
  );

  const [layout] = useState(() => (
    captureOnly ? 3 : resolveLayoutId(navLayout || saved?.layout || 1)
  ));
  const [customBg, setCustomBg] = useState(() => (
    fromBooth ? '#000000' : normalizeStripStyle(saved?.customBg)
  ));
  const [customBorder, setCustomBorder] = useState(() => (
    fromBooth ? '#000000' : normalizeStripBorder(saved?.customBorder)
  ));
  const [customPickerHex, setCustomPickerHex] = useState(() => {
    const bg = fromBooth ? '#000000' : normalizeStripStyle(saved?.customBg);
    return typeof bg === 'string' && bg.startsWith('#') ? bg : '#000000';
  });
  const [backgroundPreview, setBackgroundPreview] = useState(null);
  const [showDate, setShowDate] = useState(saved?.showDate || false);
  const [dateSize, setDateSize] = useState(saved?.dateSize || 12);
  const [dateColor, setDateColor] = useState(saved?.dateColor || '#E8A33D');
  const initialDatePosition = resolveSavedDatePosition(
    saved,
    captureOnly ? 3 : resolveLayoutId(navLayout || saved?.layout || 1)
  );
  const [dateX, setDateX] = useState(initialDatePosition.x);
  const [dateY, setDateY] = useState(initialDatePosition.y);
  const [dateFont, setDateFont] = useState(saved?.dateFont || DEFAULT_DATE_FONT);
  const [capturedPhotos, setCapturedPhotos] = useState(() => {
    if (fromBooth) return navPhotos;
    return saved?.capturedPhotos || [];
  });
  const [activePhotoId, setActivePhotoId] = useState(() => {
    const photos = fromBooth ? navPhotos : saved?.capturedPhotos || [];
    return photos[0]?.id ?? null;
  });
  // Don't restore an old strip when guest arrives with new photos from the booth
  const [strip, setStrip] = useState(() => (fromBooth || captureOnly ? null : saved?.stripImageData || null));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customFramePreview, setCustomFramePreview] = useState(null);
  const [previewStrip, setPreviewStrip] = useState(null);
  const [isPreviewGenerating, setIsPreviewGenerating] = useState(false);
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [storyDataUrl, setStoryDataUrl] = useState(null);
  const [error, setError] = useState('');
  const stripGenerationRef = useRef(0);
  const skipInitialRegenRef = useRef(
    !(fromBooth || captureOnly)
      && Boolean(saved?.stripImageData)
      && !isCssOnlyBackground(normalizeStripStyle(saved?.customBg))
  );
  const [saveMessage, setSaveMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [uploadsRemaining, setUploadsRemaining] = useState(null);
  const [guestUploadCount, setGuestUploadCount] = useState(0);
  const maxGuestUploads = 10;
  const [isCaptureOnly, setIsCaptureOnly] = useState(captureOnly);

  const finishGuestSession = () => {
    try {
      sessionStorage.removeItem('eventEditorState');
      sessionStorage.removeItem('eventCode');
    } catch {
      /* ignore */
    }
    setIsLimitModalOpen(false);
    navigate('/');
  };

  const openLimitModal = (count) => {
    if (typeof count === 'number') setGuestUploadCount(count);
    setUploadsRemaining(0);
    setIsUploadModalOpen(false);
    setIsLimitModalOpen(true);
  };

  useEffect(() => {
    if (!eventCode) return undefined;
    const guestKey = getEventGuestKey(eventCode);
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest(
          `/api/public/events/${eventCode}?guestKey=${encodeURIComponent(guestKey)}`
        );
        if (!cancelled) {
          const remaining = Number(data.event.uploadsRemaining);
          const count = Number(data.event.guestUploadCount || 0);
          setUploadsRemaining(remaining);
          setGuestUploadCount(count);
          if (remaining <= 0) {
            openLimitModal(count);
          }
          if (data.event.stripsEnabled === false || data.event.stripsEnabled === 0) {
            setIsCaptureOnly(true);
          } else if (data.event.stripsEnabled) {
            setIsCaptureOnly(false);
          }
        }
      } catch {
        if (!cancelled) setUploadsRemaining(maxGuestUploads);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventCode]);

  // Anytime remaining hits 0, force the limit modal (covers upload success + refresh)
  useEffect(() => {
    if (uploadsRemaining != null && Number(uploadsRemaining) <= 0) {
      setIsUploadModalOpen(false);
      setIsLimitModalOpen(true);
    }
  }, [uploadsRemaining]);

  // Persist incoming booth photos so refresh / remount still has them
  useEffect(() => {
    if (!fromBooth) return;
    try {
      sessionStorage.setItem(
        'eventEditorState',
        JSON.stringify({
          ...(saved || {}),
          capturedPhotos: navPhotos,
          layout: captureOnly ? null : navLayout || saved?.layout || 1,
          customBg: '#000000',
          customBorder: '#000000',
          stripsEnabled: !captureOnly,
          captureOnly,
          stripImageData: null,
        })
      );
    } catch {
      /* ignore */
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activePhoto = capturedPhotos.find((p) => p.id === activePhotoId) || capturedPhotos[0] || null;

  const handleUploadCapture = async () => {
    await trackDataAction(async () => {
    setSaveMessage('');
    setError('');
    if (!activePhoto?.src) {
      setError('Select a photo to upload.');
      return;
    }
    if (Number(uploadsRemaining) <= 0) {
      openLimitModal(guestUploadCount);
      return;
    }
    setIsSaving(true);
    try {
      const file = await dataUrlToFile(activePhoto.src, `photobothus-capture-${Date.now()}.png`);
      const guestKey = getEventGuestKey(eventCode);
      const result = await uploadStrip(
        `/api/public/events/${eventCode}/strips`,
        file,
        'Event photo',
        { guestKey }
      );
      const nextCount = Number(result.guestUploadCount ?? guestUploadCount + 1);
      const nextRemaining = Number(
        result.uploadsRemaining ?? Math.max(0, (uploadsRemaining ?? maxGuestUploads) - 1)
      );
      setGuestUploadCount(nextCount);
      setUploadsRemaining(nextRemaining);
      setSaveMessage(`Uploaded (${nextCount}/${maxGuestUploads}).`);
      setCapturedPhotos((prev) => {
        const next = prev.filter((p) => p.id !== activePhoto.id);
        setActivePhotoId(next[0]?.id ?? null);
        try {
          sessionStorage.setItem(
            'eventEditorState',
            JSON.stringify({
              capturedPhotos: next,
              captureOnly: true,
              stripsEnabled: false,
              stripImageData: null,
            })
          );
        } catch {
          /* ignore */
        }
        return next;
      });
      if (nextRemaining <= 0) {
        openLimitModal(nextCount);
      } else {
        setIsUploadModalOpen(true);
      }
    } catch (err) {
      const msg = err.message || 'Upload failed';
      if (/upload limit/i.test(msg)) {
        openLimitModal(maxGuestUploads);
      } else {
        setError(msg);
      }
    } finally {
      setIsSaving(false);
    }
    });
  };

  const handleDownloadCapture = async () => {
    if (!activePhoto?.src) return;
    await trackDataAction(async () => {
      downloadDataUrl(activePhoto.src, `photobothus-capture-${Date.now()}.png`);
    });
  };

  const persist = useCallback((state) => {
    try { sessionStorage.setItem('eventEditorState', JSON.stringify(state)); } catch {}
  }, []);

  const sync = useCallback(
    (patch) => {
      persist({
        layout,
        customBg,
        customBorder,
        showDate,
        dateSize,
        dateColor,
        dateX,
        dateY,
        dateFont,
        capturedPhotos,
        stripImageData: strip,
        ...patch,
      });
    },
    [
      persist,
      layout,
      customBg,
      customBorder,
      showDate,
      dateSize,
      dateColor,
      dateX,
      dateY,
      dateFont,
      capturedPhotos,
      strip,
    ]
  );

  const resetGeneratedStrip = useCallback((patch) => {
    setError('');
    sync(patch);
  }, [sync]);

  const generateStrip = useCallback(async ({ forExport = false } = {}) => {
    if (capturedPhotos.length === 0) return null;

    const generationId = stripGenerationRef.current + 1;
    stripGenerationRef.current = generationId;
    if (!forExport) {
      setIsGenerating(true);
    }
    setError('');

    const cssBackground = isCssOnlyBackground(customBg);

    try {
      const dataUrl = await renderStripToCanvas({
        layoutId: layout,
        photos: capturedPhotos,
        customBg,
        customBorder,
        showDate: forExport && showDate,
        dateSize,
        dateColor,
        dateX,
        dateY,
        dateFont,
        omitBackground: !forExport && cssBackground,
      });

      if (generationId !== stripGenerationRef.current) return null;

      if (!forExport) {
        setStrip(dataUrl);
        sync({ stripImageData: dataUrl });
      }
      return dataUrl;
    } catch (err) {
      if (generationId === stripGenerationRef.current) {
        setError(err.message || 'Failed to generate strip');
      }
      return null;
    } finally {
      if (!forExport && generationId === stripGenerationRef.current) {
        setIsGenerating(false);
      }
    }
  }, [capturedPhotos, customBg, customBorder, layout, showDate, dateSize, dateColor, dateX, dateY, dateFont, sync]);

  const backgroundRegenToken = isCssOnlyBackground(customBg)
    ? `css-${isLightBackground(customBg) ? 'light' : 'dark'}`
    : customBg;

  useEffect(() => {
    if (capturedPhotos.length === 0) return undefined;

    if (skipInitialRegenRef.current) {
      skipInitialRegenRef.current = false;
      return undefined;
    }

    const timer = window.setTimeout(() => {
      generateStrip();
    }, 200);

    return () => window.clearTimeout(timer);
  }, [
    capturedPhotos.length,
    layout,
    backgroundRegenToken,
    customBorder,
    generateStrip,
  ]);

  const handleDatePositionChange = useCallback((x, y, { commit } = {}) => {
    setDateX(x);
    setDateY(y);
    if (commit) {
      sync({ dateX: x, dateY: y });
    }
  }, [sync]);

  const generatePreviewStrip = useCallback(async (previewBg) => {
    if (isPreviewGenerating || capturedPhotos.length === 0) return;
    setIsPreviewGenerating(true);
    try {
      const dataUrl = await renderStripToCanvas({
        layoutId: layout,
        photos: capturedPhotos,
        customBg: previewBg,
        customBorder: '#ffffff',
        showDate,
        dateSize,
        dateColor,
        dateX,
        dateY,
        dateFont,
      });
      setPreviewStrip(dataUrl);
      return dataUrl;
    } catch {
      return null;
    } finally {
      setIsPreviewGenerating(false);
    }
  }, [capturedPhotos, layout, showDate, dateSize, dateColor, dateX, dateY, dateFont, isPreviewGenerating]);

  useEffect(() => {
    if (customFramePreview && capturedPhotos.length > 0) {
      generatePreviewStrip(customFramePreview).then((url) => {
        if (url) setPreviewStrip(url);
      });
    } else {
      setPreviewStrip(null);
    }
  }, [customFramePreview, capturedPhotos.length, generatePreviewStrip]);

  const handleDownload = async () => {
    await trackDataAction(async () => {
    const dataUrl = await generateStrip({ forExport: true });
    if (!dataUrl) return;
    downloadDataUrl(dataUrl, `photobooth-strip-${Date.now()}.png`);
    });
  };

  const handleSaveOnline = async () => {
    await trackDataAction(async () => {
    setSaveMessage('');
    setError('');
    setIsSaving(true);
    try {
      const dataUrl = await generateStrip({ forExport: true });
      if (!dataUrl) {
        setError('Finish editing your strip before uploading.');
        return;
      }
      const file = await dataUrlToFile(dataUrl, `photobooth-strip-${Date.now()}.png`);
      if (!eventCode) {
        setError('Missing event code.');
        return;
      }
      if (Number(uploadsRemaining) <= 0) {
        openLimitModal(guestUploadCount);
        return;
      }
      const guestKey = getEventGuestKey(eventCode);
      const result = await uploadStrip(
        `/api/public/events/${eventCode}/strips`,
        file,
        'Event strip',
        { guestKey }
      );
      const nextCount = Number(result.guestUploadCount ?? guestUploadCount + 1);
      const nextRemaining = Number(
        result.uploadsRemaining ?? Math.max(0, (uploadsRemaining ?? maxGuestUploads) - 1)
      );
      setGuestUploadCount(nextCount);
      setUploadsRemaining(nextRemaining);
      setSaveMessage(`Uploaded (${nextCount}/${maxGuestUploads}).`);
      if (nextRemaining <= 0) {
        openLimitModal(nextCount);
      } else {
        setIsUploadModalOpen(true);
      }
    } catch (err) {
      const msg = err.message || 'Upload failed';
      if (/upload limit/i.test(msg)) {
        openLimitModal(maxGuestUploads);
      } else {
        setError(msg);
      }
    } finally {
      setIsSaving(false);
    }
    });
  };

  const firstCapturedPhotoSrc = capturedPhotos[0]?.src;

  const generateStory = useCallback(async () => {
    if (isGenerating || isGeneratingStory || capturedPhotos.length === 0) {
      if (capturedPhotos.length === 0) setError('No photos captured yet.');
      return null;
    }

    setIsGeneratingStory(true);
    setError('');

    try {
      const stripDataUrl = await generateStrip({ forExport: true });
      if (!stripDataUrl) return null;

      const loadImage = (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = src;
        });

      const canvas = document.createElement('canvas');
      canvas.width = STORY_WIDTH;
      canvas.height = STORY_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

      const stripImage = await loadImage(stripDataUrl);
      if (!stripImage) throw new Error('Story image could not be generated');

      const drawRoundedRect = (x, y, width, height, radius) => {
        const r = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + width - r, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + r);
        ctx.lineTo(x + width, y + height - r);
        ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        ctx.lineTo(x + r, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      };

      const backgroundPhoto = await loadImage(firstCapturedPhotoSrc || stripDataUrl);
      if (!backgroundPhoto) throw new Error('Story background photo could not be generated');

      ctx.save();
      ctx.filter = 'blur(22px) brightness(0.92)';
      drawImageCover(ctx, backgroundPhoto, 0, 0, STORY_WIDTH, STORY_HEIGHT, 1);
      ctx.restore();

      const margin = 108;
      const maxPhotoWidth = STORY_WIDTH - margin * 2;
      const maxPhotoHeight = 1040;
      const scale = Math.min(maxPhotoWidth / stripImage.width, maxPhotoHeight / stripImage.height);
      const photoWidth = Math.floor(stripImage.width * scale);
      const photoHeight = Math.floor(stripImage.height * scale);
      const photoX = (STORY_WIDTH - photoWidth) / 2;
      const photoY = 360;

      ctx.save();
      ctx.shadowColor = 'rgba(124, 77, 255, 0.22)';
      ctx.shadowBlur = 34;
      ctx.shadowOffsetY = 18;
      ctx.fillStyle = '#ffffff';
      drawRoundedRect(photoX, photoY, photoWidth, photoHeight, 28);
      ctx.fill();
      ctx.restore();

      ctx.drawImage(stripImage, photoX, photoY, photoWidth, photoHeight);

      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      drawRoundedRect(photoX, photoY, photoWidth, photoHeight, 28);
      ctx.stroke();
      ctx.restore();

      return canvas.toDataURL('image/png');
    } catch (err) {
      setError(err.message || 'Failed to generate story image');
      return null;
    } finally {
      setIsGeneratingStory(false);
    }
  }, [capturedPhotos.length, firstCapturedPhotoSrc, generateStrip, isGenerating, isGeneratingStory]);

  const handleShare = async () => {
    await trackDataAction(async () => {
    const storyUrl = await generateStory();
    if (!storyUrl) return;

    setStoryDataUrl(storyUrl);
    setIsStoryModalOpen(true);
    });
  };

  const handleShareDownload = async () => {
    if (!storyDataUrl) return;

    const filename = `photobothus-story-${Date.now()}.png`;
    await trackDataAction(async () => {
    try {
      const file = await dataUrlToFile(storyDataUrl, filename);
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Photobothus Story',
          text: 'Here is my Photobothus story image.',
        });
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }

    downloadDataUrl(storyDataUrl, filename);
    });
  };

  const handleClose = () => {
    sessionStorage.removeItem('eventEditorState');
    navigate(`/e/${eventCode}/photobooth`);
  };

  const handleCustomFrameUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target.result;
        setCustomFramePreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const applyCustomFrame = () => {
    if (customFramePreview) {
      setCustomBg(customFramePreview);
      setCustomBorder('#ffffff');
      setPreviewStrip(null);
      customization.setBackground(customFramePreview);
      customization.setBorder('#ffffff');
      resetGeneratedStrip({ customBg: customFramePreview, customBorder: '#ffffff' });
      setCustomFramePreview(null);
      setIsCustomModalOpen(false);
    }
  };

  const limitModal = isLimitModalOpen
    ? createPortal(
        <div className="edit-download-modal" role="dialog" aria-modal="true" aria-labelledby="limit-modal-title">
          <div className="edit-download-modal-card">
            <h2 id="limit-modal-title">Upload limit reached</h2>
            <p>
              You’ve used all <strong>{maxGuestUploads}</strong> uploads for this event
              ({guestUploadCount}/{maxGuestUploads}).
            </p>
            <p>Thanks for sharing your moments!</p>
            <div className="custom-modal-actions">
              <button type="button" className="edit-download" onClick={finishGuestSession}>
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  if (isCaptureOnly) {
    return (
      <div className="edit-page event-capture-review">
        {limitModal}
        <header className="edit-header">
          <h1>Your captures</h1>
          <div className="edit-header-actions">
            <button
              className="edit-download"
              onClick={handleUploadCapture}
              disabled={isSaving || !activePhoto || uploadsRemaining === 0}
            >
              {isSaving
                ? 'Uploading…'
                : uploadsRemaining === 0
                  ? 'Limit reached'
                  : `Upload (${uploadsRemaining ?? maxGuestUploads} left)`}
            </button>
            <button className="edit-share" onClick={handleDownloadCapture} disabled={!activePhoto}>
              Download
            </button>
            <button className="edit-close" onClick={handleClose}>Back to booth</button>
          </div>
        </header>
        <p style={{ textAlign: 'center', color: '#6b668c', margin: '10px 0 0', fontSize: '0.92rem' }}>
          No strips — pick a photo to upload to the event.
          {' '}Up to <strong>{maxGuestUploads}</strong> uploads
          {uploadsRemaining != null ? ` (${uploadsRemaining} left)` : ''}.
        </p>
        {saveMessage && <p style={{ textAlign: 'center', color: '#5c34e0', margin: '8px 0 0' }}>{saveMessage}</p>}
        {error && <p style={{ textAlign: 'center', color: '#d54b4b', margin: '8px 0 0' }}>{error}</p>}

        {isUploadModalOpen && (
          <div className="edit-download-modal" role="dialog" aria-modal="true">
            <div className="edit-download-modal-card">
              <h2>Uploaded</h2>
              <p>Photo posted to the event gallery.</p>
              <p>
                Uploads used: {guestUploadCount}/{maxGuestUploads}
                {uploadsRemaining != null ? ` · ${uploadsRemaining} remaining.` : ''}
              </p>
              <div className="custom-modal-actions">
                <button
                  className="edit-download"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    if (capturedPhotos.length === 0) {
                      sessionStorage.removeItem('eventEditorState');
                      navigate(`/e/${eventCode}/photobooth`);
                    }
                  }}
                >
                  {capturedPhotos.length === 0 ? 'Take more' : 'Upload another'}
                </button>
                <button className="edit-modal-close" onClick={() => setIsUploadModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="event-capture-body">
          <div className="event-capture-hero">
            {activePhoto ? (
              <img
                src={activePhoto.src}
                alt="Selected capture"
                style={
                  activePhoto.filter && activePhoto.filter !== 'none'
                    ? { filter: activePhoto.filter }
                    : undefined
                }
              />
            ) : (
              <div className="edit-empty">No photos left — go back to the booth.</div>
            )}
          </div>
          {capturedPhotos.length > 0 && (
            <div className="event-capture-thumbs" aria-label="All captures">
              {capturedPhotos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  className={`event-capture-thumb${photo.id === activePhoto?.id ? ' active' : ''}`}
                  onClick={() => setActivePhotoId(photo.id)}
                >
                  <img src={photo.src} alt="" style={photo.filter && photo.filter !== 'none' ? { filter: photo.filter } : undefined} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const layoutName = layout ? getLayoutById(layout)?.name : 'Photo';

  const handleBackgroundSelect = (value, borderValue) => {
    setBackgroundPreview(null);
    setCustomBg(value);
    setCustomBorder(borderValue);
    if (typeof value === 'string' && value.startsWith('#')) {
      setCustomPickerHex(value);
    }
    customization.setBackground(value);
    customization.setBorder(borderValue);
    sync({ customBg: value, customBorder: borderValue });
  };

  const handleCustomColorPreview = (hex) => {
    setCustomPickerHex(hex);
    setBackgroundPreview(buildCustomGradient(hex));
  };

  const handleCustomColorCommit = (hex, grad, border) => {
    setBackgroundPreview(null);
    setCustomPickerHex(hex);
    setCustomBg(grad);
    setCustomBorder(border);
    customization.setBackground(grad);
    customization.setBorder(border);
    sync({ customBg: grad, customBorder: border });
  };

  const displayBackground = backgroundPreview ?? customBg;
  const frameBackgroundStyle = isCssOnlyBackground(displayBackground)
    ? getBackgroundPreviewStyle(displayBackground)
    : undefined;

  return (
    <div className="edit-page">
      {limitModal}
      <header className="edit-toolbar">
        <span className="edit-toolbar-brand">Event booth</span>
        <div className="edit-toolbar-actions">
          <button
            type="button"
            className="edit-download"
            onClick={handleSaveOnline}
            disabled={isGenerating || isSaving || uploadsRemaining === 0}
          >
            {isSaving
              ? 'Uploading…'
              : uploadsRemaining === 0
                ? 'Limit reached'
                : `Upload (${uploadsRemaining ?? maxGuestUploads} left)`}
          </button>
          <button type="button" className="edit-share" onClick={handleDownload} disabled={isGenerating}>Download</button>
          <button type="button" className="edit-share" onClick={handleShare} disabled={isGenerating || isGeneratingStory}>IG Story</button>
          <button type="button" className="edit-close" onClick={handleClose}>Back</button>
        </div>
      </header>

      <div className="edit-hero">
        <p className="hero-eyebrow">EVENT STRIP</p>
        <h1 className="edit-hero-title">Edit &amp; Upload</h1>
        <p className="edit-hero-subtitle">
          {layoutName} · up to {maxGuestUploads} uploads
          {uploadsRemaining != null ? ` (${uploadsRemaining} left)` : ''}
        </p>
      </div>

      {(saveMessage || error) && (
        <div className="edit-banner">
          {saveMessage && <p className="edit-banner-success">{saveMessage}</p>}
          {error && <p>{error}</p>}
        </div>
      )}

      {isUploadModalOpen && (
        <div className="edit-download-modal" role="dialog" aria-modal="true" aria-labelledby="upload-modal-title">
          <div className="edit-download-modal-card">
            <h2 id="upload-modal-title">Uploaded</h2>
            <p>Your strip was posted to the event gallery.</p>
            <p>
              Uploads used: {guestUploadCount}/{maxGuestUploads}
              {uploadsRemaining != null ? ` · ${uploadsRemaining} remaining.` : ''}
            </p>
            <div className="custom-modal-actions">
              <button
                className="edit-download"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  sessionStorage.removeItem('eventEditorState');
                  navigate(`/e/${eventCode}/photobooth`);
                }}
              >
                Take another
              </button>
              <button className="edit-modal-close" onClick={() => setIsUploadModalOpen(false)}>Keep editing</button>
            </div>
          </div>
        </div>
      )}

      {isStoryModalOpen && (
        <div className="edit-download-modal" role="dialog" aria-modal="true" aria-labelledby="story-modal-title">
          <div className="edit-download-modal-card story-modal-card">
            <h2 id="story-modal-title">Create Instagram Story</h2>
            {storyDataUrl && <img src={storyDataUrl} alt="Photobothus Instagram Story template" className="edit-story-preview" />}
            <p className="custom-modal-intro">Instagram does not allow web apps to upload directly to Stories. Save this image, open Instagram, create a Story, and upload it.</p>
            <ol className="story-steps">
              <li>Save the generated story image.</li>
              <li>Open Instagram and create a new Story.</li>
              <li>Upload the saved image and tap Share.</li>
            </ol>
            <div className="custom-modal-actions">
              <button className="edit-download" onClick={handleShareDownload}>Download Story</button>
              <button className="edit-modal-close" onClick={() => setIsStoryModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {isCustomModalOpen && (
        <div className="edit-custom-modal" role="dialog" aria-modal="true" aria-labelledby="custom-modal-title">
          <div className="edit-custom-modal-card">
            <h2 id="custom-modal-title">Create Custom Frame</h2>
            <div className="custom-modal-body">
              <div className="custom-modal-preview">
                {previewStrip ? (
                  <>
                    <p className="edit-accent-text">Preview with your frame:</p>
                    <img src={previewStrip} alt="Strip preview with custom frame" className="edit-strip-image" />
                  </>
                ) : (
                  <div className="edit-empty" style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Upload a frame to see preview</div>
                )}
                <div className="custom-frame-upload-section">
                  <label className="custom-frame-upload-label">Select Image</label>
                  <input
                    id="custom-frame-input"
                    type="file"
                    accept="image/*"
                    className="custom-frame-upload-input"
                    onChange={handleCustomFrameUpload}
                  />
                  <label className="custom-frame-upload-btn" htmlFor="custom-frame-input">Choose File</label>
                  {customFramePreview && (
                    <button className="custom-frame-apply-btn" onClick={applyCustomFrame}>Apply</button>
                  )}
                </div>
              </div>
              <div className="custom-modal-instructions">
                <div className="custom-modal-content">
                  <p className="custom-modal-intro">Make the frame the same size as the final strip canvas:</p>
                  <div className="custom-sizes-section">
                    <h4>Recommended Frame Sizes</h4>
                    <ul className="custom-sizes-list">
                      <li><strong>Classic / Polaroid / Wide:</strong> 520px wide (height follows layout)</li>
                      <li><strong>4x4 Frame:</strong> 520 × 780px</li>
                      <li><strong>4x6 layouts:</strong> 1000 × 667px</li>
                    </ul>
                    <p className="custom-sizes-note">Use a PNG with transparent photo areas. Match the layout aspect ratio for best results.</p>
                  </div>
                  <div className="custom-format-section">
                    <h4>Best Format</h4>
                    <ul className="custom-format-list">
                      <li>PNG format</li>
                      <li>Transparent center area</li>
                      <li>Frame/border artwork on the edges</li>
                      <li>Important details inside safe area</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <div className="custom-modal-actions">
              <button className="edit-modal-close" onClick={() => setIsCustomModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="edit-body">
        <section className="edit-result" aria-label="Your strip">
          {capturedPhotos.length === 0 ? (
            <p className="edit-empty">No photos captured yet.</p>
          ) : strip ? (
            <DraggableStripPreview
              stripSrc={strip}
              layoutId={layout || 1}
              showDate={showDate}
              dateX={dateX}
              dateY={dateY}
              onDatePositionChange={handleDatePositionChange}
              dateSize={dateSize}
              dateColor={dateColor}
              dateFont={dateFont}
              backgroundStyle={frameBackgroundStyle}
              isUpdating={isGenerating}
            />
          ) : (
            <p className="edit-empty">Preparing your strip…</p>
          )}
          {isGenerating && !strip && <p className="edit-status">Preparing your strip…</p>}
          {error && !saveMessage && <p className="edit-status edit-status-error">{error}</p>}
        </section>

        <aside className="edit-controls">
          <div className="edit-panel">
            <h4>Background</h4>
            <BackgroundStripPicker
              layoutId={layout || 1}
              presets={bgColorPresets}
              selectedBg={customBg}
              customColorHex={customPickerHex}
              onSelect={handleBackgroundSelect}
              onCustomColorPreview={handleCustomColorPreview}
              onCustomColorCommit={handleCustomColorCommit}
            />
          </div>

          <DateStampControls
            enabled={showDate}
            onEnabledChange={(value) => {
              setShowDate(value);
              resetGeneratedStrip({ showDate: value });
            }}
            size={dateSize}
            onSizeChange={(value) => {
              setDateSize(value);
              resetGeneratedStrip({ dateSize: value });
            }}
            color={dateColor}
            onColorPreview={setDateColor}
            onColorCommit={(value) => {
              setDateColor(value);
              sync({ dateColor: value });
            }}
            font={dateFont}
            onFontChange={(value) => {
              setDateFont(value);
              resetGeneratedStrip({ dateFont: value });
            }}
          />

          <div className="edit-panel edit-panel--custom">
            <h4>Custom frame</h4>
            <p>Upload your own border artwork as a PNG background.</p>
            <button type="button" className="custom-frame-btn" onClick={() => setIsCustomModalOpen(true)}>Upload frame</button>
          </div>
        </aside>
      </div>

      <footer className="home-footer edit-footer">
        <p>Your photos are private until you upload to the event.</p>
      </footer>
    </div>
  );
}

export default EventEditor;