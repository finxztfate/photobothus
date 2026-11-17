import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getLayoutById,
  resolveLayoutId,
  getLayoutPhotoCount,
  getLayoutCssClass,
} from '../data/filterTemplates';
import { filterPresets, getAvailableCameras, getFilterFrame, getFiltersForLayout } from '../data/photoboothData';
import { applyBoothFilterToImageSrc } from '../utils/captureFrame';
import './Home.css';
import './Photobooth.css';
import Camera from '../components/Camera';
import RetroFrameOverlay from '../components/RetroFrameOverlay';

const COLOR_FILTERS = filterPresets.filter((preset) => !preset.frame);

const TIMER_OPTIONS = [3, 5, 10];

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function Photobooth({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const layoutParam = searchParams.get('layout');
  const layout = layoutParam ? resolveLayoutId(layoutParam) : 1;

  const [selectedFilter, setSelectedFilter] = useState('normal');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const fileInputRef = useRef(null);

  const [timer, setTimer] = useState(3);
  const [isMirrored, setIsMirrored] = useState(true);
  const [flashEnabled, setFlashEnabled] = useState(true);
  const [countdown, setCountdown] = useState(null);
  const [isSessionRunning, setIsSessionRunning] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [capturedPhotos, setCapturedPhotos] = useState([]);

  const webcamRef = useRef(null);
  const sessionLockRef = useRef(false);

  const slotCount = getLayoutPhotoCount(layout);
  const layoutMeta = getLayoutById(layout);
  const layoutClass = getLayoutCssClass(layout);
  const isComplete = capturedPhotos.length >= slotCount;
  const activeFrame = getFilterFrame(selectedFilter);
  const frameFilters = useMemo(
    () => getFiltersForLayout(layout).filter((preset) => preset.frame),
    [layout]
  );

  useEffect(() => {
    getAvailableCameras().then((cameras) => {
      setAvailableCameras(cameras);
      if (cameras.length > 0) {
        setSelectedCamera((prev) => prev || cameras[0].id);
      }
    });
  }, []);

  useEffect(() => {
    setCapturedPhotos([]);
    setCountdown(null);
    setIsSessionRunning(false);
    sessionLockRef.current = false;
    setSelectedFilter((current) => (
      getFilterFrame(current) && !frameFilters.some((preset) => preset.id === current) ? 'normal' : current
    ));
  }, [layout, frameFilters]);

  const runCountdown = useCallback(async (seconds) => {
    let remaining = seconds;
    while (remaining > 0) {
      setCountdown(remaining);
      await delay(1000);
      remaining -= 1;
    }
    setCountdown(null);
  }, []);

  const triggerCaptureFx = useCallback(() => {
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 480);
  }, []);

  const capturePhoto = useCallback(async () => {
    const videoEl = webcamRef.current?.getVideoElement?.();
    if (!videoEl?.videoWidth || !videoEl?.videoHeight) return false;

    const imageSrc = await webcamRef.current?.captureBooth({ settleMs: 100 });
    if (!imageSrc) return false;

    setCapturedPhotos((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), src: imageSrc, filter: 'none', frame: activeFrame },
    ]);
    return true;
  }, [activeFrame]);

  const resetSession = useCallback(() => {
    setCapturedPhotos([]);
  }, []);

  const handleStartSession = useCallback(async () => {
    if (sessionLockRef.current || isSessionRunning) return;

    if (isComplete) {
      if (!window.confirm(`You already have ${slotCount} photos. Retake them all?`)) return;
      resetSession();
      return;
    }

    sessionLockRef.current = true;
    setIsSessionRunning(true);

    try {
      const remaining = slotCount - capturedPhotos.length;
      for (let i = 0; i < remaining; i += 1) {
        await runCountdown(timer);
        triggerCaptureFx();
        const ok = await capturePhoto();
        if (!ok) {
          window.alert('Camera not ready. Please try again.');
          break;
        }
        if (i < remaining - 1) await delay(500);
      }
    } finally {
      setIsSessionRunning(false);
      sessionLockRef.current = false;
    }
  }, [
    isSessionRunning,
    isComplete,
    slotCount,
    resetSession,
    capturedPhotos.length,
    runCountdown,
    timer,
    flashEnabled,
    triggerCaptureFx,
    capturePhoto,
  ]);

  const handleDone = () => {
    if (!isComplete) return;
    navigate('/editor', { state: { photos: capturedPhotos.slice(0, slotCount), layout } });
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const slotsLeft = slotCount - capturedPhotos.length;
    if (slotsLeft <= 0) {
      if (!window.confirm(`You already have ${slotCount} photos. Replace them all?`)) {
        e.target.value = '';
        return;
      }
      setCapturedPhotos([]);
    }

    const remaining = slotCount - capturedPhotos.length;
    const toRead = files.slice(0, remaining > 0 ? remaining : slotCount);
    const filterCss = filterPresets.find((preset) => preset.id === selectedFilter)?.css || 'none';

    const results = await Promise.all(
      toRead.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (ev) => {
              const rawSrc = ev.target.result;
              const filteredSrc = await applyBoothFilterToImageSrc(rawSrc, { filterCss });
              resolve({
                id: Date.now() + Math.random(),
                src: filteredSrc || rawSrc,
                filter: 'none',
                frame: activeFrame,
              });
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          })
      )
    );

    const photos = results.filter(Boolean);
    if (photos.length) {
      setCapturedPhotos((prev) => {
        const base = remaining > 0 ? prev : [];
        return [...base, ...photos].slice(0, slotCount);
      });
    }

    e.target.value = '';
  };

  const switchCamera = () => {
    if (availableCameras.length < 2) return;
    const currentIndex = availableCameras.findIndex((c) => c.id === selectedCamera);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    setSelectedCamera(availableCameras[nextIndex].id);
  };

  const startLabel = isSessionRunning
    ? 'Capturing…'
    : isComplete
      ? 'Retake'
      : capturedPhotos.length > 0
        ? 'Take next photo'
        : 'Start';

  return (
    <div className="photobooth-page">
      <header className="booth-chrome">
        <div className="booth-chrome-primary">
          <button type="button" className="booth-chrome-btn" onClick={() => navigate('/')}>
            ← Home
          </button>
          <div className="booth-chrome-center">
            <span className="booth-chrome-name">Photobothus</span>
            <span className="booth-chrome-meta">
              {layoutMeta?.name || 'Classic Strip'} · {capturedPhotos.length}/{slotCount}
            </span>
          </div>
          <div className="booth-chrome-actions">
            <button type="button" className="booth-chrome-btn" onClick={() => navigate('/layouts')}>
              Layouts
            </button>
            <button
              type="button"
              className="booth-theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <svg className="theme-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg className="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="booth-toolbar">
          <label className="booth-timer">
            <span>Timer</span>
            <select
              value={timer}
              onChange={(e) => setTimer(Number(e.target.value))}
              disabled={isSessionRunning}
            >
              {TIMER_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}s</option>
              ))}
            </select>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleFileSelect}
          />
          <button
            type="button"
            className="booth-tool-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSessionRunning}
          >
            Upload
          </button>

          {availableCameras.length > 1 && (
            <label className="booth-timer">
              <span>Camera</span>
              <select
                value={selectedCamera || ''}
                onChange={(e) => setSelectedCamera(e.target.value)}
                disabled={isSessionRunning}
              >
                {availableCameras.map((camera) => (
                  <option key={camera.id} value={camera.id}>{camera.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </header>

      <div className="booth-session">
        <div className="booth-camera-row">
          <div className={`camera-preview booth-camera layout-${layoutClass}`}>
            {showFlash && (
              <div className="booth-capture-fx" aria-hidden="true">
                <span className="booth-shutter booth-shutter--top" />
                <span className="booth-shutter booth-shutter--bottom" />
                {flashEnabled && <span className="booth-flash" />}
              </div>
            )}
            {countdown !== null && (
              <div className="countdown-overlay">
                <span key={countdown} className="countdown-number bounce">{countdown}</span>
              </div>
            )}
            <Camera
              ref={webcamRef}
              selectedFilter={selectedFilter}
              mirrored={isMirrored}
              deviceId={selectedCamera}
              onSwitchCamera={availableCameras.length > 1 ? switchCamera : null}
              frameId={activeFrame}
              frameIndex={Math.min(capturedPhotos.length, slotCount - 1)}
            />
          </div>

          <section className="booth-shots" aria-label="Captured photos">
            <div className="booth-thumbs">
              {capturedPhotos.map((photo, index) => (
                <div key={photo.id} className="booth-thumb">
                  <img src={photo.src} alt={`Capture ${index + 1}`} />
                  <RetroFrameOverlay frameId={photo.frame} index={index} />
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="booth-actions">
          <div className="booth-actions-side booth-actions-side--left">
            <button
              type="button"
              className="booth-toggle-btn"
              onClick={() => setIsMirrored((v) => !v)}
              disabled={isSessionRunning}
            >
              Mirror: {isMirrored ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              className="booth-toggle-btn"
              onClick={() => setShowFilterModal(true)}
              disabled={isSessionRunning}
            >
              Filters
            </button>
          </div>

          <div className="booth-start-done">
            <button
              type="button"
              className="booth-start-btn"
              onClick={handleStartSession}
              disabled={isSessionRunning}
            >
              {startLabel}
            </button>
            {isComplete && (
              <button type="button" className="booth-done-btn" onClick={handleDone}>
                Done
              </button>
            )}
          </div>

          <div className="booth-actions-side booth-actions-side--right">
            <button
              type="button"
              className={`booth-toggle-btn${flashEnabled ? ' is-active' : ''}`}
              onClick={() => setFlashEnabled((v) => !v)}
              disabled={isSessionRunning}
            >
              Flash: {flashEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      </div>

      {showFilterModal && (
        <div
          className="booth-filter-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="filter-modal-title"
          onClick={() => setShowFilterModal(false)}
        >
          <div className="booth-filter-card" onClick={(e) => e.stopPropagation()}>
            <div className="booth-filter-head">
              <h2 id="filter-modal-title">Choose a filter</h2>
              <button type="button" className="booth-filter-close" onClick={() => setShowFilterModal(false)} aria-label="Close">
                ×
              </button>
            </div>
            {[
              { title: 'Colour', items: COLOR_FILTERS },
              {
                title: 'Retro frames',
                hint: `Picked for ${layoutMeta?.name || 'this layout'}`,
                items: frameFilters,
              },
            ].map((group) => (
              <div key={group.title} className="booth-filter-group">
                <h3 className="booth-filter-group-title">
                  {group.title}
                  {group.hint && <span className="booth-filter-group-hint">{group.hint}</span>}
                </h3>
                <div className="booth-filter-grid">
                  {group.items.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`booth-filter-option${selectedFilter === f.id ? ' active' : ''}`}
                      onClick={() => {
                        setSelectedFilter(f.id);
                        setShowFilterModal(false);
                      }}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Photobooth;
