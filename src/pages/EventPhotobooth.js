import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { getLayoutById, getLayoutCssClass, getLayoutPhotoCount, resolveLayoutId, getBoothCaptureAspect } from '../data/filterTemplates';
import { filterPresets, getAvailableCameras } from '../data/photoboothData';
import { apiRequest, getEventGuestKey } from '../utils/api';
import './EventPhotobooth.css';
import './EventEditor.css';
import Camera from '../components/Camera';

const EVENT_SINGLE_LAYOUT = 3; // Polaroid — 1 photo

function getLayoutType(layoutId) {
  return getLayoutCssClass(layoutId);
}

function getLayoutStyle() {
  return '';
}

function getSlots(layoutId) {
  return Array.from({ length: getLayoutPhotoCount(layoutId) });
}

function EventPhotobooth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { code: eventCode } = useParams();
  const templateParam = searchParams.get('layout');

  const [eventInfo, setEventInfo] = useState(null);
  const [limitReached, setLimitReached] = useState(false);
  const [guestUploadCount, setGuestUploadCount] = useState(0);
  const maxGuestUploads = 10;
  const [selectedFilter, setSelectedFilter] = useState('normal');
  const [isMirrored, setIsMirrored] = useState(true);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);

  const webcamRef = useRef(null);
  const isCapturingRef = useRef(false);

  const initialLayout = templateParam ? resolveLayoutId(templateParam) : 1;
  const [layout, setLayout] = useState(() => resolveLayoutId(initialLayout));
  const captureAspect = getBoothCaptureAspect();

  useEffect(() => {
    if (!eventCode) return undefined;
    sessionStorage.setItem('eventCode', eventCode);
    let cancelled = false;
    (async () => {
      try {
        const guestKey = getEventGuestKey(eventCode);
        const data = await apiRequest(
          `/api/public/events/${eventCode}?guestKey=${encodeURIComponent(guestKey)}`
        );
        if (cancelled) return;
        setEventInfo(data.event);
        setGuestUploadCount(data.event.guestUploadCount || 0);
        if (Number(data.event.uploadsRemaining) <= 0) {
          setLimitReached(true);
        }
        if (data.event && !data.event.stripsEnabled) {
          setLayout(EVENT_SINGLE_LAYOUT);
        }
      } catch {
        if (!cancelled) setEventInfo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventCode]);

  useEffect(() => {
    const param = searchParams.get('layout');
    if (!param) return;
    if (eventInfo && !eventInfo.stripsEnabled) {
      setLayout(EVENT_SINGLE_LAYOUT);
      return;
    }
    setLayout(resolveLayoutId(param));
  }, [searchParams, eventInfo]);

  useEffect(() => {
    getAvailableCameras().then((cameras) => {
      setAvailableCameras(cameras);
      if (cameras.length > 0) {
        setSelectedCamera((prev) => prev || cameras[0].id);
      }
    });
  }, []);

  useEffect(() => {
    const slotCount = getSlots(layout).length;
    setSelectedIds((prev) => {
      const valid = prev
        .filter((id) => capturedPhotos.some((p) => p.id === id))
        .slice(0, slotCount);
      if (valid.length === prev.length && valid.every((id, i) => id === prev[i])) return prev;
      return valid;
    });
  }, [capturedPhotos, layout]);

  const handleCapture = async () => {
    if (isCapturingRef.current) return;
    isCapturingRef.current = true;
    setIsCapturing(true);
    setTimeout(() => {
      isCapturingRef.current = false;
      setIsCapturing(false);
    }, 700);

    const videoEl = webcamRef.current?.getVideoElement?.();
    if (!videoEl?.videoWidth || !videoEl?.videoHeight) return;

    const imageSrc = await webcamRef.current?.captureBooth({ settleMs: 100 });
    if (!imageSrc) return;

    const photo = { id: Date.now() + Math.random(), src: imageSrc, filter: 'none' };
    setCapturedPhotos((prev) => [...prev, photo]);

    if (eventInfo?.stripsEnabled) {
      const slotCount = getSlots(layout).length;
      setSelectedIds((prev) => (prev.length < slotCount ? [...prev, photo.id] : prev));
    }
  };

  const goToEditor = (photos) => {
    const stripsEnabled = !!eventInfo?.stripsEnabled;
    try {
      sessionStorage.setItem(
        'eventEditorState',
        JSON.stringify({
          capturedPhotos: photos,
          layout: stripsEnabled ? layout : null,
          customBg: '#000000',
          customBorder: '#000000',
          stripsEnabled,
          captureOnly: !stripsEnabled,
          stripImageData: null,
        })
      );
    } catch {
      // Quota / private mode — rely on router state
    }
    navigate(`/e/${eventCode}/editor`, {
      state: { photos, layout: stripsEnabled ? layout : null, eventCode, stripsEnabled, captureOnly: !stripsEnabled },
    });
  };

  const toggleSelectPhoto = (photoId) => {
    if (!eventInfo?.stripsEnabled) return; // capture-only: no strip slot picking
    const slotCount = getSlots(layout).length;
    setSelectedIds((prev) => {
      if (prev.includes(photoId)) return prev.filter((id) => id !== photoId);
      if (prev.length >= slotCount) return prev;
      return [...prev, photoId];
    });
  };

  const removeCapturedPhoto = (photoId) => {
    setCapturedPhotos((prev) => prev.filter((p) => p.id !== photoId));
    setSelectedIds((prev) => prev.filter((id) => id !== photoId));
  };

  const clearEventPhotos = () => {
    setCapturedPhotos([]);
    setSelectedIds([]);
  };

  const switchCamera = () => {
    if (availableCameras.length < 2) return;
    const currentIndex = availableCameras.findIndex((c) => c.id === selectedCamera);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    setSelectedCamera(availableCameras[nextIndex].id);
  };

  const stripsOn = !!eventInfo?.stripsEnabled;
  const layoutClass = stripsOn
    ? `${getLayoutType(layout)}${getLayoutStyle(layout) ? ` ${getLayoutStyle(layout)}` : ''}`.trim()
    : 'capture-only';
  const slotCount = getSlots(layout).length;
  const canContinue = stripsOn
    ? selectedIds.length >= slotCount || capturedPhotos.length >= slotCount
    : capturedPhotos.length > 0;

  const photosForEditor = () => {
    if (stripsOn && selectedIds.length >= slotCount) {
      return selectedIds
        .slice(0, slotCount)
        .map((id) => capturedPhotos.find((p) => p.id === id))
        .filter(Boolean);
    }
    return capturedPhotos;
  };

  return (
    <div className="event-mobile-booth">
      {limitReached &&
        createPortal(
          <div className="edit-download-modal" role="dialog" aria-modal="true">
            <div className="edit-download-modal-card">
              <h2>Upload limit reached</h2>
              <p>
                You’ve used all <strong>{maxGuestUploads}</strong> uploads for this event
                ({guestUploadCount}/{maxGuestUploads}).
              </p>
              <p>Thanks for sharing your moments!</p>
              <div className="custom-modal-actions">
                <button
                  type="button"
                  className="edit-download"
                  onClick={() => {
                    try {
                      sessionStorage.removeItem('eventEditorState');
                      sessionStorage.removeItem('eventCode');
                    } catch {
                      /* ignore */
                    }
                    navigate('/');
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <p className="event-mobile-desktop-note">
        Best on your phone — open this event link on mobile for the full guest booth.
      </p>

      <div className="event-mobile-phone">
        <header className="event-mobile-top">
          <div className="event-mobile-top-text">
            <strong>{eventInfo?.name || 'Event booth'}</strong>
            <span>
              {capturedPhotos.length === 0
                ? 'Snap freely · upload limit later'
                : stripsOn
                  ? `${capturedPhotos.length} shot${capturedPhotos.length === 1 ? '' : 's'} · select ${slotCount} for strip (${selectedIds.length}/${slotCount})`
                  : `${capturedPhotos.length} capture${capturedPhotos.length === 1 ? '' : 's'} ready`}
            </span>
          </div>
          <div className="event-mobile-top-actions">
            {stripsOn && (
              <button
                type="button"
                className="event-mobile-chip"
                onClick={() => navigate(`/e/${eventCode}/layouts`)}
              >
                Layout
              </button>
            )}
          </div>
        </header>

        <div
          className={`event-mobile-preview camera-preview ${layoutClass}`}
          style={{ '--booth-photo-aspect': captureAspect, aspectRatio: captureAspect }}
        >
          <Camera
            ref={webcamRef}
            selectedFilter={selectedFilter}
            mirrored={isMirrored}
            deviceId={selectedCamera}
            onSwitchCamera={availableCameras.length > 1 ? switchCamera : null}
          />

          <div className="event-mobile-filters">
            {filterPresets.slice(0, 8).map((f) => (
              <button
                key={f.id}
                type="button"
                className={`event-mobile-filter${selectedFilter === f.id ? ' active' : ''}`}
                onClick={() => setSelectedFilter(f.id)}
              >
                {f.name}
              </button>
            ))}
          </div>

          <div className="event-mobile-preview-controls">
            <button
              type="button"
              className="event-mobile-icon-btn"
              onClick={() => setIsMirrored((prev) => !prev)}
              aria-label={isMirrored ? 'Disable mirror' : 'Enable mirror'}
            >
              {isMirrored ? '⇔' : '⇆'}
            </button>
            <button
              type="button"
              className="event-mobile-shutter"
              onClick={() => {
                if (!isCapturing) handleCapture();
              }}
              disabled={isCapturing}
              aria-label="Take photo"
            />
            {availableCameras.length > 1 ? (
              <button
                type="button"
                className="event-mobile-icon-btn"
                onClick={switchCamera}
                aria-label="Switch camera"
              >
                ↻
              </button>
            ) : (
              <span className="event-mobile-icon-spacer" />
            )}
          </div>
        </div>

        {capturedPhotos.length > 0 && (
          <div className="event-mobile-gallery" aria-label="Photos taken">
            {capturedPhotos.map((photo) => {
              const selectedIndex = selectedIds.indexOf(photo.id);
              const isSelected = stripsOn && selectedIndex >= 0;
              return (
                <div
                  key={photo.id}
                  className={`event-mobile-thumb${isSelected ? ' selected' : ''}`}
                >
                  <button
                    type="button"
                    className="event-mobile-thumb-btn"
                    onClick={() => toggleSelectPhoto(photo.id)}
                    aria-pressed={isSelected}
                    aria-label={stripsOn ? 'Select for strip' : 'Captured photo'}
                  >
                    <img src={photo.src} alt="" style={{ filter: photo.filter }} />
                    {isSelected && (
                      <span className="event-mobile-thumb-order">{selectedIndex + 1}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="event-mobile-thumb-remove"
                    onClick={() => removeCapturedPhoto(photo.id)}
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <footer className="event-mobile-footer">
          {capturedPhotos.length > 0 && (
            <button type="button" className="event-mobile-secondary" onClick={clearEventPhotos}>
              Clear
            </button>
          )}
          <button
            type="button"
            className="event-mobile-primary"
            disabled={!canContinue}
            onClick={() => goToEditor(photosForEditor())}
          >
            {stripsOn ? 'Continue to editor' : 'Review photos'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default EventPhotobooth;
