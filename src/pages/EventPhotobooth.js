import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import Camera from '../components/Camera';
import {
  getAvailableCameras,
  getFilterFrame,
} from '../data/photoboothData';
import {
  getLayoutById,
  getLayoutPhotoCount,
  resolveLayoutId,
} from '../data/stripLayouts';
import './EventPhotobooth.css';

const LIVE_FILTERS = ['normal', 'bwfilm', 'vintage', 'seventies'];
const VIEWFINDER_ASPECT = 3 / 4;

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

  const layout = resolveLayoutId(searchParams.get('layout') || 1);
  const layoutMeta = getLayoutById(layout);
  const slotCount = getLayoutPhotoCount(layout);
  const captureOnly = event?.stripsEnabled === false;

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

  useEffect(() => {
    getAvailableCameras().then((cameras) => {
      setAvailableCameras(cameras);
      if (cameras.length > 0) {
        setSelectedCamera((prev) => prev || cameras[0].id);
      }
    });
  }, []);

  useEffect(() => () => {
    if (countdownRef.current) window.clearInterval(countdownRef.current);
  }, []);

  const shotNumber = retakeIndex != null
    ? retakeIndex + 1
    : Math.min(capturedPhotos.length + 1, slotCount);

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
        aspect: VIEWFINDER_ASPECT,
        mirrored: false,
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
        const finishedRetake = retakeIndex != null;
        if (finishedRetake || next.length >= slotCount) {
          setScene('review');
        }
        return next;
      });
      setRetakeIndex(null);
    } finally {
      capturingRef.current = false;
      setIsCapturing(false);
    }
  }, [retakeIndex, selectedFilter, slotCount]);

  const startCountdown = useCallback(() => {
    if (capturingRef.current || countdown != null) return;
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

  const switchCamera = () => {
    if (availableCameras.length < 2) return;
    const currentIndex = availableCameras.findIndex((c) => c.id === selectedCamera);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    setSelectedCamera(availableCameras[nextIndex].id);
  };

  const beginRetake = (index) => {
    setRetakeIndex(index);
    setScene('capture');
  };

  return (
    <div className="event-mobile-booth">
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
                  onClick={() => setTimerSeconds((prev) => (prev === 3 ? 5 : 3))}
                  aria-label="Toggle timer"
                >
                  {timerSeconds}s
                </button>
              </div>
            </div>

            <div className="event-booth-stage">
              <div className="event-booth-viewfinder">
                <Camera
                  ref={cameraRef}
                  selectedFilter={selectedFilter}
                  mirrored
                  orientation="portrait"
                  objectFit="cover"
                  deviceId={selectedCamera}
                  onError={setCameraError}
                />
                {countdown != null && (
                  <div className="event-booth-countdown" aria-live="assertive">{countdown}</div>
                )}
                {flash && <div className="event-booth-flash" />}
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
              <button
                type="button"
                className="event-booth-shutter"
                disabled={isCapturing || countdown != null || capturedPhotos.length >= slotCount}
                onClick={startCountdown}
                aria-label="Take photo"
              />
              {capturedPhotos.length >= slotCount && (
                <button type="button" className="event-booth-primary" onClick={() => setScene('review')}>
                  Review shots
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default EventPhotobooth;
