import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { resolveLayoutId, getLayoutById } from '../../../data/stripLayouts';
import { buildCustomGradient, getBackgroundPreviewStyle, isCssOnlyBackground } from '../../../data/editorBackgrounds';
import { renderStripToCanvas, isLightBackground } from '../../../utils/stripCompositor';
import { customization } from '../../../utils/customization';
import { getEventGuestKey, apiRequest, patchEventStrip, patchHostStrip } from '../../../utils/api';
import { dataUrlToFile } from '../../../utils/dataUrlFile';
import { applyLookToEventStrips } from '../../../utils/eventLook';
import { clearEditorSession } from '../../../utils/eventSession';
import { DEFAULT_MAX_GUEST_UPLOADS } from '../../../data/eventLimits';
import { DEFAULT_DATE_FONT } from '../../../components/DateStampControls';
import {
  DEFAULT_STRIP_BG,
  DEFAULT_STRIP_BORDER,
  downloadDataUrl,
  loadEditorState,
  saveEditorState,
  normalizeStripStyle,
  normalizeStripBorder,
  resolveSavedDatePosition,
  photosFromUrls,
  lookFromFields,
  saveStatusLabel,
  initialEditorLayout,
  shouldSkipInitialRegen,
} from './utils/eventEditorState';
import EventEditorToolbar from './components/EventEditorToolbar';
import { EventLimitModal, EventDoneModal } from './components/EventEditorModals';
import EventCaptureReview from './components/EventCaptureReview';
import EventEditorLookView from './components/EventEditorLookView';
import '../../Home.css';
import '../../EditPage.css';
import './EventEditor.css';

function EventEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { code: eventCode, id: hostEventId, stripId: hostStripId } = useParams();
  const isHostEditor = Boolean(hostEventId && hostStripId);
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
  const startingLayout = initialEditorLayout({ captureOnly, navLayout, saved });

  const [layout, setLayout] = useState(startingLayout);
  const [customBg, setCustomBg] = useState(() => (
    fromBooth ? DEFAULT_STRIP_BG : normalizeStripStyle(saved?.customBg)
  ));
  const [customBorder, setCustomBorder] = useState(() => (
    fromBooth ? DEFAULT_STRIP_BORDER : normalizeStripBorder(saved?.customBorder)
  ));
  const [customPickerHex, setCustomPickerHex] = useState(() => {
    const bg = fromBooth ? DEFAULT_STRIP_BG : normalizeStripStyle(saved?.customBg);
    return typeof bg === 'string' && bg.startsWith('#') ? bg : DEFAULT_STRIP_BG;
  });
  const [backgroundPreview, setBackgroundPreview] = useState(null);
  const [showDate, setShowDate] = useState(saved?.showDate || false);
  const [dateSize, setDateSize] = useState(saved?.dateSize || 12);
  const [dateColor, setDateColor] = useState(saved?.dateColor || '#E8A33D');
  const initialDatePosition = resolveSavedDatePosition(saved, startingLayout);
  const [dateX, setDateX] = useState(initialDatePosition.x);
  const [dateY, setDateY] = useState(initialDatePosition.y);
  const [dateFont, setDateFont] = useState(saved?.dateFont || DEFAULT_DATE_FONT);
  const [capturedPhotos, setCapturedPhotos] = useState(() => (
    fromBooth ? navPhotos : saved?.capturedPhotos || []
  ));
  const [activePhotoId, setActivePhotoId] = useState(() => {
    const photos = fromBooth ? navPhotos : saved?.capturedPhotos || [];
    return photos[0]?.id ?? null;
  });
  const [strip, setStrip] = useState(() => (fromBooth || captureOnly ? null : saved?.stripImageData || null));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customFramePreview, setCustomFramePreview] = useState(null);
  const [previewStrip, setPreviewStrip] = useState(null);
  const [isPreviewGenerating, setIsPreviewGenerating] = useState(false);
  const [error, setError] = useState('');
  const stripGenerationRef = useRef(0);
  const skipInitialRegenRef = useRef(shouldSkipInitialRegen({ fromBooth, captureOnly, saved }));
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [isDoneOpen, setIsDoneOpen] = useState(false);
  const [uploadsRemaining, setUploadsRemaining] = useState(null);
  const [guestUploadCount, setGuestUploadCount] = useState(0);
  const [maxGuestUploads, setMaxGuestUploads] = useState(DEFAULT_MAX_GUEST_UPLOADS);
  const [isCaptureOnly, setIsCaptureOnly] = useState(captureOnly);
  const [stripId, setStripId] = useState(() => location.state?.stripId || saved?.stripId || hostStripId || null);
  const [saveStatus, setSaveStatus] = useState(
    location.state?.savedToEvent || saved?.stripId ? 'saved' : 'idle'
  );
  const [hostLoading, setHostLoading] = useState(isHostEditor);
  const lookDirtyRef = useRef(false);
  const skipLookSaveRef = useRef(true);

  const lookFields = {
    customBg, customBorder, showDate, dateSize, dateColor, dateX, dateY, dateFont,
  };

  const finishGuestSession = () => {
    clearEditorSession();
    setIsLimitModalOpen(false);
    navigate('/');
  };

  const applyLook = (look) => {
    if (!look || typeof look !== 'object') return;
    if (look.customBg) {
      setCustomBg(look.customBg);
      if (typeof look.customBg === 'string' && look.customBg.startsWith('#')) {
        setCustomPickerHex(look.customBg);
      }
    }
    if (look.customBorder) setCustomBorder(look.customBorder);
    if (look.showDate != null) setShowDate(!!look.showDate);
    if (look.dateSize != null) setDateSize(look.dateSize);
    if (look.dateColor) setDateColor(look.dateColor);
    if (typeof look.dateX === 'number') setDateX(look.dateX);
    if (typeof look.dateY === 'number') setDateY(look.dateY);
    if (look.dateFont) setDateFont(look.dateFont);
  };

  useEffect(() => {
    if (!eventCode || isHostEditor) return undefined;
    const guestKey = getEventGuestKey(eventCode);
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest(
          `/api/public/events/${eventCode}?guestKey=${encodeURIComponent(guestKey)}`
        );
        if (cancelled) return;
        const remaining = Number(data.event.uploadsRemaining);
        const count = Number(data.event.guestUploadCount || 0);
        setUploadsRemaining(remaining);
        setGuestUploadCount(count);
        if (Number(data.event.maxGuestUploads) > 0) {
          setMaxGuestUploads(Number(data.event.maxGuestUploads));
        }
        if (remaining <= 0 && !stripId) {
          setGuestUploadCount(count);
          setUploadsRemaining(0);
          setIsLimitModalOpen(true);
        }
        if (data.event.stripsEnabled === false || data.event.stripsEnabled === 0) {
          setIsCaptureOnly(true);
        } else if (data.event.stripsEnabled) {
          setIsCaptureOnly(false);
        }
      } catch {
        if (!cancelled) setUploadsRemaining(DEFAULT_MAX_GUEST_UPLOADS);
      }
    })();
    return () => { cancelled = true; };
  }, [eventCode, isHostEditor, stripId]);

  useEffect(() => {
    if (stripId) return;
    if (uploadsRemaining != null && Number(uploadsRemaining) <= 0) {
      setIsLimitModalOpen(true);
    }
  }, [uploadsRemaining, stripId]);

  useEffect(() => {
    if (!fromBooth) return;
    saveEditorState({
      ...(saved || {}),
      capturedPhotos: navPhotos,
      layout: captureOnly ? null : navLayout || saved?.layout || 1,
      customBg: DEFAULT_STRIP_BG,
      customBorder: DEFAULT_STRIP_BORDER,
      stripsEnabled: !captureOnly,
      captureOnly,
      stripImageData: null,
      stripId: location.state?.stripId || saved?.stripId || null,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isHostEditor) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest(`/api/events/${hostEventId}/strips/${hostStripId}`);
        if (cancelled) return;
        const photos = photosFromUrls(data.strip.photoUrls, data.strip.id);
        if (photos.length) {
          setCapturedPhotos(photos);
          setActivePhotoId(photos[0].id);
        }
        if (data.strip.layoutId) {
          setLayout(resolveLayoutId(data.strip.layoutId));
          setIsCaptureOnly(false);
        } else {
          setIsCaptureOnly(true);
        }
        applyLook(data.strip.look);
        setStripId(data.strip.id);
        setSaveStatus('saved');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load this strip');
      } finally {
        if (!cancelled) setHostLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hostEventId, hostStripId, isHostEditor]);

  const activePhoto = capturedPhotos.find((p) => p.id === activePhotoId) || capturedPhotos[0] || null;

  const persist = useCallback((state) => saveEditorState(state), []);

  const sync = useCallback((patch) => {
    persist({
      layout,
      ...lookFromFields({ customBg, customBorder, showDate, dateSize, dateColor, dateX, dateY, dateFont }),
      capturedPhotos,
      stripImageData: strip,
      stripId,
      captureOnly: isCaptureOnly,
      ...patch,
    });
  }, [
    persist, layout, customBg, customBorder, showDate, dateSize, dateColor,
    dateX, dateY, dateFont, capturedPhotos, strip, stripId, isCaptureOnly,
  ]);

  const resetGeneratedStrip = useCallback((patch) => {
    setError('');
    lookDirtyRef.current = true;
    sync(patch);
  }, [sync]);

  const generateStrip = useCallback(async ({ forExport = false } = {}) => {
    if (capturedPhotos.length === 0) return null;
    const generationId = stripGenerationRef.current + 1;
    stripGenerationRef.current = generationId;
    if (!forExport) setIsGenerating(true);
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
    if (capturedPhotos.length === 0 || isCaptureOnly) return undefined;
    if (skipInitialRegenRef.current) {
      skipInitialRegenRef.current = false;
      return undefined;
    }
    const timer = window.setTimeout(() => generateStrip(), 200);
    return () => window.clearTimeout(timer);
  }, [capturedPhotos.length, layout, backgroundRegenToken, customBorder, generateStrip, isCaptureOnly]);

  const saveLookToEvent = useCallback(async ({ allStrips = false } = {}) => {
    if (!stripId) return;
    try {
      setSaveStatus('updating');
      const look = lookFromFields(lookFields);
      let previewFile = null;
      if (isCaptureOnly) {
        const src = activePhoto?.src;
        if (src && src.startsWith('data:')) {
          previewFile = await dataUrlToFile(src, `event-photo-${Date.now()}.png`);
        }
      } else {
        const dataUrl = await generateStrip({ forExport: true });
        if (dataUrl) previewFile = await dataUrlToFile(dataUrl, `event-strip-${Date.now()}.png`);
      }
      if (isHostEditor) {
        await patchHostStrip(hostEventId, stripId, { look, previewFile, applyToEvent: allStrips });
        if (allStrips) {
          setSaveStatus('applying');
          await applyLookToEventStrips({
            eventId: hostEventId,
            look,
            skipStripId: stripId,
            sourceLayoutId: layout,
          });
        }
      } else {
        await patchEventStrip(eventCode, stripId, {
          guestKey: getEventGuestKey(eventCode),
          look,
          previewFile,
        });
      }
      setSaveStatus('saved');
      lookDirtyRef.current = false;
    } catch (err) {
      setSaveStatus('error');
      setError(err.message || 'Could not update the event');
    }
  }, [
    activePhoto, eventCode, generateStrip, hostEventId, isCaptureOnly,
    isHostEditor, layout, stripId, customBg, customBorder, showDate,
    dateSize, dateColor, dateX, dateY, dateFont,
  ]);

  useEffect(() => {
    if (skipLookSaveRef.current) {
      skipLookSaveRef.current = false;
      return undefined;
    }
    if (!stripId || hostLoading) return undefined;
    lookDirtyRef.current = true;
    const timer = window.setTimeout(() => saveLookToEvent(), 400);
    return () => window.clearTimeout(timer);
  }, [
    customBg, customBorder, showDate, dateSize, dateColor, dateX, dateY, dateFont,
    activePhotoId, saveLookToEvent, stripId, hostLoading,
  ]);

  const handleDatePositionChange = useCallback((x, y, { commit } = {}) => {
    setDateX(x);
    setDateY(y);
    if (commit) {
      lookDirtyRef.current = true;
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

  const handleClose = async () => {
    if (isHostEditor) {
      if (lookDirtyRef.current) await saveLookToEvent({ allStrips: true });
      navigate(`/events/${hostEventId}`);
      return;
    }
    sessionStorage.removeItem('eventEditorState');
    navigate(`/e/${eventCode}/photobooth`);
  };

  const handleDone = async () => {
    if (isHostEditor) {
      await saveLookToEvent({ allStrips: true });
      navigate(`/events/${hostEventId}`);
      return;
    }
    if (lookDirtyRef.current) await saveLookToEvent();
    setIsDoneOpen(true);
  };

  const handleHostDownload = async () => {
    try {
      await saveLookToEvent({ allStrips: true });
      if (isCaptureOnly) {
        if (!activePhoto?.src) return;
        downloadDataUrl(activePhoto.src, `event-photo-${Date.now()}.png`);
        return;
      }
      const dataUrl = await generateStrip({ forExport: true });
      if (!dataUrl) return;
      downloadDataUrl(dataUrl, `event-strip-${Date.now()}.png`);
    } catch (err) {
      setError(err.message || 'Could not download this strip');
    }
  };

  const applyCustomFrame = () => {
    if (!customFramePreview) return;
    setCustomBg(customFramePreview);
    setCustomBorder('#ffffff');
    setPreviewStrip(null);
    customization.setBackground(customFramePreview);
    customization.setBorder('#ffffff');
    resetGeneratedStrip({ customBg: customFramePreview, customBorder: '#ffffff' });
    setCustomFramePreview(null);
    setIsCustomModalOpen(false);
  };

  const handleBackgroundSelect = (value, borderValue) => {
    setBackgroundPreview(null);
    setCustomBg(value);
    setCustomBorder(borderValue);
    if (typeof value === 'string' && value.startsWith('#')) setCustomPickerHex(value);
    customization.setBackground(value);
    customization.setBorder(borderValue);
    sync({ customBg: value, customBorder: borderValue });
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
  const statusLabel = saveStatusLabel(saveStatus, isHostEditor);
  const layoutId = layout || 1;

  const toolbar = (
    <EventEditorToolbar
      isHostEditor={isHostEditor}
      onDownload={handleHostDownload}
      onDone={handleDone}
      onClose={handleClose}
    />
  );

  if (hostLoading) {
    return (
      <div className="edit-page">
        {toolbar}
        <p className="edit-empty">Loading strip…</p>
      </div>
    );
  }

  return (
    <div className={`edit-page${isCaptureOnly ? ' event-capture-review' : ''}`}>
      <EventLimitModal
        open={isLimitModalOpen && !isHostEditor}
        maxGuestUploads={maxGuestUploads}
        guestUploadCount={guestUploadCount}
        onDone={finishGuestSession}
      />
      <EventDoneModal
        open={isDoneOpen}
        onTakeAnother={() => {
          setIsDoneOpen(false);
          sessionStorage.removeItem('eventEditorState');
          navigate(`/e/${eventCode}/photobooth`);
        }}
        onClose={finishGuestSession}
      />
      {toolbar}
      {isCaptureOnly ? (
        <EventCaptureReview
          capturedPhotos={capturedPhotos}
          activePhoto={activePhoto}
          onSelectPhoto={setActivePhotoId}
          statusLabel={statusLabel}
          saveStatus={saveStatus}
          error={error}
        />
      ) : (
        <EventEditorLookView
          isHostEditor={isHostEditor}
          layoutId={layoutId}
          layoutName={layout ? getLayoutById(layout)?.name : 'Photo'}
          capturedPhotos={capturedPhotos}
          strip={strip}
          isGenerating={isGenerating}
          showDate={showDate}
          dateX={dateX}
          dateY={dateY}
          dateSize={dateSize}
          dateColor={dateColor}
          dateFont={dateFont}
          onDatePositionChange={handleDatePositionChange}
          frameBackgroundStyle={frameBackgroundStyle}
          customBg={customBg}
          customPickerHex={customPickerHex}
          onBackgroundSelect={handleBackgroundSelect}
          onCustomColorPreview={(hex) => {
            setCustomPickerHex(hex);
            setBackgroundPreview(buildCustomGradient(hex));
          }}
          onCustomColorCommit={handleCustomColorCommit}
          onShowDateChange={(value) => {
            setShowDate(value);
            resetGeneratedStrip({ showDate: value });
          }}
          onDateSizeChange={(value) => {
            setDateSize(value);
            resetGeneratedStrip({ dateSize: value });
          }}
          onDateColorPreview={setDateColor}
          onDateColorCommit={(value) => {
            setDateColor(value);
            sync({ dateColor: value });
          }}
          onDateFontChange={(value) => {
            setDateFont(value);
            resetGeneratedStrip({ dateFont: value });
          }}
          isCustomModalOpen={isCustomModalOpen}
          previewStrip={previewStrip}
          customFramePreview={customFramePreview}
          onSelectFrame={setCustomFramePreview}
          onApplyFrame={applyCustomFrame}
          onCloseFrame={() => setIsCustomModalOpen(false)}
          onOpenFrame={() => setIsCustomModalOpen(true)}
          statusLabel={statusLabel}
          saveStatus={saveStatus}
          error={error}
        />
      )}
    </div>
  );
}

export default EventEditor;
