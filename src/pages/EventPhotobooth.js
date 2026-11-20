import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import Camera from '../components/Camera';
import LayoutPreview from '../components/LayoutPreview';
import {
  getAvailableCameras,
  getFilterFrame,
} from '../data/photoboothData';
import {
  getLayoutById,
  getLayoutPhotoCount,
  resolveLayoutId,
} from '../data/stripLayouts';
import { enterMobileFullscreen } from '../utils/mobileFullscreen';
import './EventPhotobooth.css';

const LIVE_FILTERS = ['normal', 'bwfilm', 'vintage', 'seventies'];
const TIMER_CYCLE = [3, 5, 0];

function nextTimer(seconds) {
  const index = TIMER_CYCLE.indexOf(seconds);
  return TIMER_CYCLE[(index < 0 ? 0 : index + 1) % TIMER_CYCLE.length];
}

function timerLabel(seconds) {
  return seconds <= 0 ? 'Instant' : `${seconds}s`;
}

function liveFilterLabel(id) {
  if (id === 'bwfilm') return 'B&W';
  if (id === 'seventies') return 'Warm';
  if (id === 'normal') return 'Original';
  if (id === 'vintage') return 'Vintage';
  return id;
}

function EventPhotobooth() {
  const { event, code } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cameraRef = useRef(null);
  const countdownRef = useRef(null);
  const capturingRef = useRef(false);

  const captureOnly = event != null && !event.stripsEnabled;
  const layout = captureOnly ? 3 : resolveLayoutId(searchParams.get('layout') || 1);
  const layoutMeta = getLayoutById(layout);
  const slotCount = getLayoutPhotoCount(layout);

  const [scene, setScene] = useState('capture');
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [retakeIndex, setRetakeIndex] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(3);
  const [flash, setFlash] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('normal');
  const [cameraError, setCameraError] = useState('');
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [mirrored, setMirrored] = useState(true);

  useEffect(() => {
    getAvailableCameras().then(setAvailableCameras);
  }, []);

  useEffect(() => () => {
    if (countdownRef.current) window.clearInterval(countdownRef.current);
  }, []);

  const shotNumber = retakeIndex != null
    ? retakeIndex + 1
    : Math.min(capturedPhotos.length + 1, slotCount);
  const canCapture = retakeIndex != null || capturedPhotos.length < slotCount;

  const goEditor = useCallback((photos) => {
    navigate(`/e/${code}/editor`, {
      state: {
        photos,
        layout: captureOnly ? 3 : layout,
        captureOnly,
        stripsEnabled: !captureOnly,
      },
    });
  }, [captureOnly, code, layout, navigate]);

  const takeShot = useCallback(async () => {
    if (!cameraRef.current || capturingRef.current) return;
    capturingRef.current = true;
    setIsCapturing(true);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);
    try {
      const dataUrl = await cameraRef.current.captureBooth({
        aspect: 3 / 4,
        fit: 'cover',
        mirrored,
        settleMs: 50,
      });
      if (!dataUrl) {
        setCameraError('Camera not ready. Try again.');
        return;
      }
      const photo = {
        id: Date.now() + Math.random(),
        src: dataUrl,
        filter: 'none',
        frame: getFilterFrame(selectedFilter),
      };
      setCapturedPhotos((prev) => {
        let next;
        if (retakeIndex != null && retakeIndex >= 0 && retakeIndex < prev.length) {
          next = [...prev];
          next[retakeIndex] = photo;
        } else {
          next = [...prev, photo].slice(0, slotCount);
        }
        if (retakeIndex == null && next.length >= slotCount) {
          setScene('review');
        }
        return next;
      });
      setRetakeIndex(null);
    } finally {
      capturingRef.current = false;
      setIsCapturing(false);
    }
  }, [mirrored, retakeIndex, selectedFilter, slotCount]);

  const startCountdown = useCallback(() => {
    enterMobileFullscreen();
    if (capturingRef.current || countdown != null) return;
    if (timerSeconds <= 0) {
      takeShot();
      return;
    }
    let remaining = timerSeconds;
    setCountdown(remaining);
    countdownRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearInterval(countdownRef.current);
        countdownRef.current = null;
        setCountdown(null);
        takeShot();
        return;
      }
      setCountdown(remaining);
    }, 1000);
  }, [countdown, takeShot, timerSeconds]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code !== 'Space' && event.key !== ' ') return;
      if (event.repeat) return;
      if (scene !== 'capture' || isCapturing || countdown != null || !canCapture) {
        return;
      }
      const target = event.target;
      if (target instanceof Element && target.closest('button, a, input, textarea, select, [contenteditable="true"]')) {
        return;
      }
      event.preventDefault();
      startCountdown();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [scene, isCapturing, countdown, canCapture, startCountdown]);

  const switchCamera = () => {
    if (availableCameras.length < 2) return;
    const currentIndex = availableCameras.findIndex((c) => c.id === selectedCamera);
    const nextIndex = currentIndex < 0 ? 1 % availableCameras.length : (currentIndex + 1) % availableCameras.length;
    setSelectedCamera(availableCameras[nextIndex].id);
  };

  const beginRetake = (index) => {
    setRetakeIndex(index);
    setScene('capture');
  };

  const onBoothInteract = (event) => {
    if (event.target instanceof Element && event.target.closest('.event-booth-back')) return;
    enterMobileFullscreen();
  };

  return (
    <div className="event-mobile-booth" onPointerDown={onBoothInteract}>
      <div className="event-mobile-phone">
        {scene === 'review' ? (
          <div className="event-booth-review">
            <div className="event-booth-topbar">
              <Link to={captureOnly ? `/e/${code}` : `/e/${code}/layouts`} className="event-booth-back">
                Back
              </Link>
              <p className="event-booth-progress">Review</p>
              <span className="event-booth-top-spacer" />
            </div>
            <p className="event-booth-review-hint">Tap a shot to retake just that frame.</p>
            <div className={`event-booth-review-grid ${slotCount <= 2 ? 'is-few' : ''}`}>
              {capturedPhotos.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  className="event-booth-review-shot"
                  onClick={() => beginRetake(index)}
                >
                  <img src={photo.src} alt={`Shot ${index + 1}`} />
                  <span>Retake {index + 1}</span>
                </button>
              ))}
            </div>
            <div className="event-booth-review-actions">
              <button type="button" className="event-booth-secondary" onClick={() => setScene('capture')}>
                Back to camera
              </button>
              <button
                type="button"
                className="event-booth-primary"
                disabled={capturedPhotos.length < slotCount}
                onClick={() => goEditor(capturedPhotos)}
              >
                Customize &amp; download
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="event-booth-topbar">
              <Link to={captureOnly ? `/e/${code}` : `/e/${code}/layouts`} className="event-booth-back">
                Back
              </Link>
              <p className="event-booth-progress">
                {shotNumber} / {slotCount}
              </p>
              <div className="event-booth-top-actions">
                {availableCameras.length > 1 && (
                  <button type="button" className="event-booth-icon-btn" onClick={switchCamera}>
                    Flip
                  </button>
                )}
                <button
                  type="button"
                  className="event-booth-icon-btn is-active"
                  onClick={() => setTimerSeconds(nextTimer)}
                  aria-label={`Timer ${timerLabel(timerSeconds)}. Cycle instant, 3 seconds, 5 seconds.`}
                >
                  {timerLabel(timerSeconds)}
                </button>
              </div>
            </div>

            <div className="event-booth-stage">
              <div className="event-booth-viewfinder">
                <Camera
                  ref={cameraRef}
                  selectedFilter={selectedFilter}
                  mirrored={mirrored}
                  orientation="portrait"
                  objectFit="cover"
                  deviceId={selectedCamera}
                  onError={setCameraError}
                  showFullscreenButton={false}
                  sharp
                />
                {countdown != null && (
                  <div className="event-booth-countdown" aria-live="assertive">{countdown}</div>
                )}
                {flash && <div className="event-booth-flash" />}
                {capturedPhotos.length > 0 && (
                  <LayoutPreview
                    layout={layout}
                    photos={capturedPhotos}
                    className="event-booth-strip-preview"
                    onPhotoClick={setRetakeIndex}
                    activePhotoIndex={retakeIndex ?? capturedPhotos.length}
                    emptyLabel
                  />
                )}
              </div>
            </div>

            {cameraError && <p className="event-booth-error">{cameraError}</p>}
            {layoutMeta?.name && (
              <p className="event-booth-layout-name">{layoutMeta.name}</p>
            )}

            <div className="event-booth-dock">
              <div className="event-booth-filters" role="tablist" aria-label="Live filters">
                {LIVE_FILTERS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={selectedFilter === id}
                    className={`event-booth-filter ${selectedFilter === id ? 'is-active' : ''}`}
                    onClick={() => setSelectedFilter(id)}
                  >
                    {liveFilterLabel(id)}
                  </button>
                ))}
              </div>
              <div className="event-booth-shutter-row">
                <button
                  type="button"
                  className="event-booth-dock-side"
                  disabled={capturedPhotos.length === 0}
                  onClick={() => setScene('review')}
                >
                  Review shots
                </button>
                <button
                  type="button"
                  className="event-booth-shutter"
                  disabled={isCapturing || countdown != null || !canCapture}
                  onClick={startCountdown}
                  aria-label="Take photo"
                />
                <button
                  type="button"
                  className={`event-booth-dock-side${mirrored ? ' is-active' : ''}`}
                  onClick={() => setMirrored((on) => !on)}
                  aria-pressed={mirrored}
                  aria-label={mirrored ? 'Mirror on' : 'Mirror off'}
                >
                  Mirror
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default EventPhotobooth;
