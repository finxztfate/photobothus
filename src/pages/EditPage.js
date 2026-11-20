import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { resolveLayoutId, getLayoutById, getStripPrintSize, shouldPrintTwinStrips } from '../data/stripLayouts';
import { bgColorPresets, buildCustomGradient, getBackgroundPreviewStyle, isCssOnlyBackground } from '../data/editorBackgrounds';
import { renderStripToCanvas, getDefaultDatePosition, isLightBackground, printPhotoboothStrip } from '../utils/stripCompositor';
import { customization } from '../utils/customization';
import { uploadStrip } from '../utils/api';
import { trackDataAction } from '../utils/loadingBus';
import { useAuth } from '../utils/auth';
import BackgroundStripPicker from '../components/BackgroundStripPicker';
import DateStampControls, { normalizeDatePlacement, DEFAULT_DATE_FONT } from '../components/DateStampControls';
import DraggableStripPreview from '../components/DraggableStripPreview';
import {
  IconDownload,
  IconGallery,
  IconPrint,
  StripPrintSpec,
} from '../components/StripExportIcons';
import './Home.css';
import './EditPage.css';

function loadEditorState() {
  try {
    return JSON.parse(sessionStorage.getItem('editorState'));
  } catch {
    return null;
  }
}

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

function EditPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const saved = loadEditorState();
  const navPhotos = location.state?.photos;
  const navLayout = location.state?.layout;
  const fromBooth = Array.isArray(navPhotos) && navPhotos.length > 0;

  const [layout] = useState(() => resolveLayoutId(navLayout || saved?.layout || 1));
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
  const initialDatePosition = resolveSavedDatePosition(saved, resolveLayoutId(navLayout || saved?.layout || 1));
  const [dateX, setDateX] = useState(initialDatePosition.x);
  const [dateY, setDateY] = useState(initialDatePosition.y);
  const [dateFont, setDateFont] = useState(saved?.dateFont || DEFAULT_DATE_FONT);
  const [capturedPhotos] = useState(() => {
    if (navPhotos && navPhotos.length > 0) return navPhotos;
    return saved?.capturedPhotos || [];
  });
  const [strip, setStrip] = useState(() => (fromBooth ? null : saved?.stripImageData || null));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customFramePreview, setCustomFramePreview] = useState(null);
  const [previewStrip, setPreviewStrip] = useState(null);
  const [isPreviewGenerating, setIsPreviewGenerating] = useState(false);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimerRef = useRef(null);
  // Signed-in customers can also keep the strip in their account gallery.
  const { isCustomer } = useAuth();
  const [isSavingToGallery, setIsSavingToGallery] = useState(false);
  const [justSavedToGallery, setJustSavedToGallery] = useState(false);
  const galleryTimerRef = useRef(null);
  const stripGenerationRef = useRef(0);
  const skipInitialRegenRef = useRef(
    !fromBooth
      && Boolean(saved?.stripImageData)
      && !isCssOnlyBackground(normalizeStripStyle(saved?.customBg))
  );

  useEffect(() => {
    if (!fromBooth) return;
    try {
      sessionStorage.setItem(
        'editorState',
        JSON.stringify({
          ...(saved || {}),
          capturedPhotos: navPhotos,
          layout: resolveLayoutId(navLayout || saved?.layout || 1),
          customBg: '#000000',
          customBorder: '#000000',
          stripImageData: null,
        })
      );
    } catch {
      /* ignore */
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = useCallback((state) => {
    try { sessionStorage.setItem('editorState', JSON.stringify(state)); } catch {}
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
    } catch (err) {
      setError(err.message || 'Failed to generate preview');
    } finally {
      setIsPreviewGenerating(false);
    }
  }, [capturedPhotos, layout, showDate, dateSize, dateColor, dateX, dateY, dateFont, isPreviewGenerating]);

  useEffect(() => {
    if (customFramePreview && capturedPhotos.length > 0) {
      generatePreviewStrip(customFramePreview).then(() => {
        /* preview state updated inside generatePreviewStrip */
      });
    } else {
      setPreviewStrip(null);
    }
  }, [customFramePreview, capturedPhotos.length, generatePreviewStrip]);

  const handleDownload = async () => {
    await trackDataAction(async () => {
    setIsExporting(true);
    try {
      const dataUrl = await generateStrip({ forExport: true });
      if (!dataUrl) return;
      downloadDataUrl(dataUrl, `photobooth-strip-${Date.now()}.png`);
      setHasDownloaded(true);
      setJustSaved(true);
      window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => setJustSaved(false), 2200);
    } finally {
      setIsExporting(false);
    }
    });
  };

  const handlePrint = async () => {
    await trackDataAction(async () => {
      setIsPrinting(true);
      try {
        const dataUrl = await generateStrip({ forExport: true });
        if (!dataUrl) return;
        await printPhotoboothStrip(dataUrl, layout);
        setHasDownloaded(true);
      } catch (err) {
        setError(err.message || 'Could not print this strip');
      } finally {
        setIsPrinting(false);
      }
    });
  };

  useEffect(() => () => window.clearTimeout(savedTimerRef.current), []);

  const handleSaveToGallery = async () => {
    await trackDataAction(async () => {
    setIsSavingToGallery(true);
    try {
      const dataUrl = await generateStrip({ forExport: true });
      if (!dataUrl) return;
      const file = await dataUrlToFile(dataUrl, `photobooth-strip-${Date.now()}.png`);
      await uploadStrip('/api/strips', file, getLayoutById(layout)?.name || 'Photo strip');
      // The strip is safe in the account now, so leaving no longer needs a warning.
      setHasDownloaded(true);
      setJustSavedToGallery(true);
      window.clearTimeout(galleryTimerRef.current);
      galleryTimerRef.current = window.setTimeout(() => setJustSavedToGallery(false), 2200);
    } catch (err) {
      setError(err.message || 'Could not save to your gallery');
    } finally {
      setIsSavingToGallery(false);
    }
    });
  };

  useEffect(() => () => window.clearTimeout(galleryTimerRef.current), []);

  const confirmLeave = (message) => (
    hasDownloaded || capturedPhotos.length === 0 || window.confirm(message)
  );

  const handleClose = () => {
    if (!confirmLeave('Leave the editor? Your strip has not been downloaded yet.')) return;
    sessionStorage.removeItem('editorState');
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const handleRetake = () => {
    if (!confirmLeave('Retake your photos? This strip will be discarded.')) return;
    sessionStorage.removeItem('editorState');
    navigate(`/photobooth?layout=${getLayoutById(layout)?.slug || layout}`);
  };

  useEffect(() => {
    if (!isCustomModalOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setIsCustomModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isCustomModalOpen]);

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

  const layoutName = getLayoutById(layout)?.name || 'Classic Strip';

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

  const backgroundName = (() => {
    if (typeof customBg === 'string' && customBg.startsWith('data:image')) return 'Your frame';
    return bgColorPresets.find((preset) => preset.value === customBg)?.name || 'Custom color';
  })();
  const isBusy = isGenerating || isExporting || isPrinting || isSavingToGallery;
  const printSize = getStripPrintSize(layout);

  const displayBackground = backgroundPreview ?? customBg;
  const frameBackgroundStyle = isCssOnlyBackground(displayBackground)
    ? getBackgroundPreviewStyle(displayBackground)
    : undefined;

  return (
    <div className="edit-page edit-page--studio">
      <header className="edit-toolbar">
        <button type="button" className="edit-tool-btn" onClick={handleRetake}>
          <span aria-hidden="true">←</span> Retake
        </button>
        <span className="edit-toolbar-brand">Photobothus</span>
        <button type="button" className="edit-tool-btn" onClick={handleClose} aria-label="Close editor">
          Close <span aria-hidden="true">✕</span>
        </button>
      </header>

      {isCustomModalOpen && (
        <div
          className="edit-custom-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="custom-modal-title"
          onClick={() => setIsCustomModalOpen(false)}
        >
          <div className="edit-custom-modal-card" onClick={(e) => e.stopPropagation()}>
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
        <section className="edit-result edit-stage" aria-label="Your strip">
          <div className="edit-stage-canvas">
            {capturedPhotos.length === 0 ? (
              <div className="edit-stage-empty">
                <p className="edit-empty">No photos captured yet.</p>
                <button type="button" className="edit-download" onClick={() => navigate('/photobooth')}>
                  Open the photobooth
                </button>
              </div>
            ) : strip ? (
              <DraggableStripPreview
                stripSrc={strip}
                layoutId={layout}
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
              <div className="edit-stage-loading" role="status">
                <span className="edit-spinner" aria-hidden="true" />
                Preparing your strip…
              </div>
            )}
            {isGenerating && strip && (
              <span className="edit-stage-badge" role="status">
                <span className="edit-spinner edit-spinner--sm" aria-hidden="true" />
                Updating
              </span>
            )}
          </div>
          {capturedPhotos.length > 0 && (
            <p className="edit-stage-caption">
              <span className="edit-stage-chip">{layoutName}</span>
              {capturedPhotos.length} {capturedPhotos.length === 1 ? 'photo' : 'photos'}
              {showDate && <span className="edit-stage-tip"> · Drag the date to move it</span>}
            </p>
          )}
          {error && <p className="edit-status edit-status-error" role="alert">{error}</p>}
        </section>

        <aside className="edit-controls edit-sidebar">
          <div className="edit-sidebar-head">
            <h1 className="edit-sidebar-title">Customize your strip</h1>
            <p className="edit-sidebar-sub">Pick a background, add a date, then save it.</p>
          </div>

          <div className="edit-sidebar-scroll">
            <div className="edit-panel">
              <div className="edit-panel-head">
                <h4>Background</h4>
                <span className="edit-panel-value">{backgroundName}</span>
              </div>
              <BackgroundStripPicker
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

            <div className="edit-panel edit-panel--custom-row">
              <div className="edit-custom-row-text">
                <h4>Custom frame</h4>
                <p>Use your own PNG artwork as the strip background.</p>
              </div>
              <button type="button" className="edit-outline-btn" onClick={() => setIsCustomModalOpen(true)}>
                Upload
              </button>
            </div>
          </div>

          <div className="edit-actions">
            <StripPrintSpec size={printSize} twin={shouldPrintTwinStrips(layout)} />
            <button
              type="button"
              className={`edit-download edit-action-primary edit-export-btn${justSaved ? ' is-saved' : ''}`}
              onClick={handleDownload}
              disabled={isBusy || capturedPhotos.length === 0}
            >
              <IconDownload />
              {justSaved ? 'Saved to your device' : isExporting ? 'Preparing…' : 'Download strip'}
            </button>
            <div className={`edit-actions-split${isCustomer ? '' : ' is-single'}`}>
              <button
                type="button"
                className="edit-share edit-action-secondary edit-export-btn"
                onClick={handlePrint}
                disabled={isBusy || capturedPhotos.length === 0}
              >
                <IconPrint />
                {isPrinting ? 'Preparing…' : 'Print'}
              </button>
              {isCustomer && (
                <button
                  type="button"
                  className="edit-share edit-action-secondary edit-export-btn"
                  onClick={handleSaveToGallery}
                  disabled={isBusy || capturedPhotos.length === 0}
                >
                  <IconGallery />
                  {justSavedToGallery
                    ? 'Saved to gallery'
                    : isSavingToGallery
                      ? 'Saving…'
                      : 'Save to gallery'}
                </button>
              )}
            </div>
            <p className="edit-actions-note">
              {isCustomer
                ? 'Your photos stay on this device unless you save them to your gallery.'
                : 'Your photos stay private on this device.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default EditPage;