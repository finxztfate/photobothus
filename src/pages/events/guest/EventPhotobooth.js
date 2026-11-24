import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { getAvailableCameras, getFilterFrame } from '../../../data/photoboothData';
import { getLayoutById, getLayoutPhotoCount, resolveLayoutId } from '../../../data/stripLayouts';
import { enterMobileFullscreen } from '../../../utils/mobileFullscreen';
import { saveEventBoothSession } from '../../../utils/eventBoothSession';
import { layoutsAllowedForGuest } from '../../../utils/eventLayoutCapacity';
import EventBoothCapture from './components/EventBoothCapture';
import EventBoothReview from './components/EventBoothReview';
import EventBoothDone from './components/EventBoothDone';
import './EventPhotobooth.css';

const TIMER_CYCLE = [3, 5, 0];

function nextTimer(seconds) {
  const index = TIMER_CYCLE.indexOf(seconds);
  return TIMER_CYCLE[(index < 0 ? 0 : index + 1) % TIMER_CYCLE.length];
}

function timerLabel(seconds) {
  return seconds <= 0 ? 'Instant' : `${seconds}s`;
}

function EventPhotobooth() {
  const { code, event } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cameraRef = useRef(null);
  const countdownRef = useRef(null);
  const capturingRef = useRef(false);
  const savingRef = useRef(false);

  const layout = resolveLayoutId(searchParams.get('layout') || 1);
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
  const [finderAspect, setFinderAspect] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    getAvailableCameras().then(setAvailableCameras);
  }, []);

  useEffect(() => {
    if (!event) return;
    const allowed = layoutsAllowedForGuest(event.allowedLayouts).map((item) => item.id);
    if (!allowed.includes(layout)) {
      navigate(`/e/${code}/layouts`, { replace: true });
    }
  }, [event, layout, code, navigate]);

  useEffect(() => () => {
    if (countdownRef.current) window.clearInterval(countdownRef.current);
  }, []);

  const shotNumber = retakeIndex != null
    ? retakeIndex + 1
    : Math.min(capturedPhotos.length + 1, slotCount);
  const canCapture = retakeIndex != null || capturedPhotos.length < slotCount;

  const saveSession = useCallback(async (photos) => {
    if (savingRef.current || !photos?.length) return;
    savingRef.current = true;
    setIsSaving(true);
    setSaveError('');
    try {
      await saveEventBoothSession({ code, layoutId: layout, photos });
      setScene('done');
    } catch (err) {
      setSaveError(err.message || 'Couldn’t save. Check your connection.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [code, layout]);

  const retakeAll = () => {
    setCapturedPhotos([]);
    setRetakeIndex(null);
    setSaveError('');
    setScene('capture');
  };

  const takeShot = useCallback(async () => {
    if (!cameraRef.current || capturingRef.current) return;
    capturingRef.current = true;
    setIsCapturing(true);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);
    try {
      const dataUrl = await cameraRef.current.captureNative({
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

  const onBoothInteract = (event) => {
    if (event.target instanceof Element && event.target.closest('.event-booth-back')) return;
    enterMobileFullscreen();
  };

  return (
    <div className="event-mobile-booth" onPointerDown={onBoothInteract}>
      <div className="event-mobile-phone">
        {scene === 'done' ? (
          <EventBoothDone
            onClose={() => navigate(`/e/${code}`)}
            onTakeAnother={retakeAll}
          />
        ) : scene === 'review' ? (
          <EventBoothReview
            code={code}
            photos={capturedPhotos}
            slotCount={slotCount}
            isSaving={isSaving}
            saveError={saveError}
            onRetake={(index) => {
              setRetakeIndex(index);
              setScene('capture');
            }}
            onRetakeAll={retakeAll}
            onSend={() => saveSession(capturedPhotos)}
          />
        ) : (
          <EventBoothCapture
            code={code}
            layout={layout}
            layoutName={layoutMeta?.name}
            slotCount={slotCount}
            shotNumber={shotNumber}
            canCapture={canCapture}
            capturedPhotos={capturedPhotos}
            retakeIndex={retakeIndex}
            isCapturing={isCapturing}
            countdown={countdown}
            timerLabel={timerLabel(timerSeconds)}
            onCycleTimer={() => setTimerSeconds(nextTimer)}
            selectedFilter={selectedFilter}
            onFilterChange={setSelectedFilter}
            cameraError={cameraError}
            onCameraError={setCameraError}
            flash={flash}
            availableCameras={availableCameras}
            selectedCamera={selectedCamera}
            onSwitchCamera={switchCamera}
            mirrored={mirrored}
            onToggleMirror={() => setMirrored((on) => !on)}
            finderAspect={finderAspect}
            onFinderAspect={setFinderAspect}
            cameraRef={cameraRef}
            onShutter={startCountdown}
            onReview={() => setScene('review')}
            onRetakeIndex={setRetakeIndex}
          />
        )}
      </div>
    </div>
  );
}

export default EventPhotobooth;
