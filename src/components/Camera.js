import React, { forwardRef, useRef, useImperativeHandle, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { captureNativeFrame, captureBoothFrame } from '../utils/captureFrame';
import { filterPresets } from '../data/photoboothData';
import RetroFrameOverlay from './RetroFrameOverlay';

const filters = Object.fromEntries(filterPresets.map((preset) => [preset.id, preset.css]));

function getVideoRect(videoEl, containerEl) {
  if (!videoEl || !containerEl) return null;

  const videoW = videoEl.videoWidth;
  const videoH = videoEl.videoHeight;
  if (!videoW || !videoH) return null;

  const containerW = containerEl.clientWidth;
  const containerH = containerEl.clientHeight;
  if (!containerW || !containerH) return null;

  const videoAspect = videoW / videoH;
  const containerAspect = containerW / containerH;

  let renderedW, renderedH, offsetX, offsetY;

  if (videoAspect > containerAspect) {
    renderedH = containerH;
    renderedW = containerH * videoAspect;
    offsetX = (containerW - renderedW) / 2;
    offsetY = 0;
  } else {
    renderedW = containerW;
    renderedH = containerW / videoAspect;
    offsetX = 0;
    offsetY = (containerH - renderedH) / 2;
  }


  const scaleX = renderedW / videoW;
  const scaleY = renderedH / videoH;

  return { offsetX, offsetY, scaleX, scaleY };
}

function getOverlayStyle(face, videoEl, containerEl) {
  if (!face || !videoEl || !containerEl) return null;

  const box = face.detection?.box;
  const landmarks = face.landmarks;
  if (!box || typeof box.x !== 'number' || typeof box.y !== 'number' || typeof box.width !== 'number' || typeof box.height !== 'number') return null;

  const rect = getVideoRect(videoEl, containerEl);
  if (!rect) return null;

  const { offsetX, offsetY, scaleX, scaleY } = rect;

  let centerX = box.x + box.width / 2;
  let centerY = box.y;

  if (landmarks) {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    if (leftEye && rightEye && leftEye.length > 0 && rightEye.length > 0) {
      const leftCenter = leftEye.reduce(
        (acc, pt) => ({ x: acc.x + pt.x, y: acc.y + pt.y }),
        { x: 0, y: 0 }
      );
      leftCenter.x /= leftEye.length;
      leftCenter.y /= leftEye.length;

      const rightCenter = rightEye.reduce(
        (acc, pt) => ({ x: acc.x + pt.x, y: acc.y + pt.y }),
        { x: 0, y: 0 }
      );
      rightCenter.x /= rightEye.length;
      rightCenter.y /= rightEye.length;

      centerX = (leftCenter.x + rightCenter.x) / 2;
      centerY = Math.min(leftCenter.y, rightCenter.y);
    }
  }

  return {
    position: 'absolute',
    left: offsetX + centerX * scaleX,
    top: offsetY + centerY * scaleY,
    transform: 'translate(-50%, -50%)',
    width: Math.max(box.width * scaleX * 2.5, 80),
    height: 'auto',
    pointerEvents: 'none',
    zIndex: 10,
  };
}

async function getFilteredScreenshot(
  videoEl,
  filterCss,
  outputWidth,
  outputHeight,
  overlayImage = null,
  overlayStyle = null,
  mirrored = false,
  settleMs = 100
) {
  if (!videoEl) return null;

  const sourceWidth = videoEl.videoWidth;
  const sourceHeight = videoEl.videoHeight;
  if (!sourceWidth || !sourceHeight) return null;

  if (settleMs > 0) {
    await new Promise((resolve) => {
      setTimeout(resolve, settleMs);
    });
  }

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = outputWidth / outputHeight;

  let sx;
  let sy;
  let sw;
  let sh;

  if (sourceAspect > targetAspect) {
    sh = sourceHeight;
    sw = sh * targetAspect;
    sx = (sourceWidth - sw) / 2;
    sy = 0;
  } else {
    sw = sourceWidth;
    sh = sw / targetAspect;
    sx = 0;
    sy = (sourceHeight - sh) / 2;
  }

  if (mirrored) {
    ctx.translate(outputWidth, 0);
    ctx.scale(-1, 1);
  }

  ctx.filter = filterCss;

  ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);

  if (overlayImage && overlayStyle) {
    const img = new Image();
    img.src = overlayImage;
    await new Promise(resolve => {
      if (img.complete) return resolve();
      img.onload = resolve;
    });

    const overlayWidth = parseFloat(overlayStyle.width) || 80;
    const left = parseFloat(overlayStyle.left) || 0;
    const top = parseFloat(overlayStyle.top) || 0;

    ctx.drawImage(img, left - overlayWidth / 2, top - overlayWidth * 0.75, overlayWidth, overlayWidth * 1.5);
  }

  return canvas.toDataURL('image/png');
}

const Camera = forwardRef(function Camera(
  {
    selectedFilter = 'normal',
    overlayImage = null,
    detectedFace = null,
    mirrored = false,
    deviceId = null,
    onSwitchCamera = null,
    onVideoDimensionsChange = null,
    frameId = null,
    frameIndex = 0,
  },
  ref
) {
  const internalWebcamRef = useRef(null);
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;

    if (!isFullscreen) {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      } else if (el.mozRequestFullScreen) {
        await el.mozRequestFullScreen();
      } else if (el.msRequestFullscreen) {
        await el.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        await document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const getVideoConstraints = () => {
    if (deviceId) {
      return {
        deviceId,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        facingMode: 'user'
      };
    }

    return {
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    };
  };

  const getVideoElementRaw = () => {
    const instance = internalWebcamRef.current;
    if (!instance) return null;
    if (instance instanceof HTMLVideoElement) return instance;
    if (instance.video instanceof HTMLVideoElement) return instance.video;
    if (typeof instance.querySelector === 'function') {
      const el = instance.querySelector('video');
      if (el instanceof HTMLVideoElement) return el;
    }
    return null;
  };

  const getVideoEl = () => {
    const video = getVideoElementRaw();
    if (!video?.videoWidth || !video?.videoHeight) return null;
    return video;
  };

  const reportVideoDimensions = (videoEl) => {
    const video = videoEl || getVideoElementRaw();
    if (!onVideoDimensionsChange || !video?.videoWidth || !video?.videoHeight) return;
    onVideoDimensionsChange({
      width: video.videoWidth,
      height: video.videoHeight,
      aspect: video.videoWidth / video.videoHeight,
    });
  };

  const handleVideoReady = (event) => {
    const videoEl = event?.target instanceof HTMLVideoElement ? event.target : getVideoElementRaw();
    reportVideoDimensions(videoEl);
  };

  const handleUserMedia = () => {
    window.requestAnimationFrame(() => reportVideoDimensions());
    window.setTimeout(() => reportVideoDimensions(), 250);
  };

  useEffect(() => {
    reportVideoDimensions();
    const video = getVideoElementRaw();
    if (!video) return undefined;

    video.addEventListener('loadedmetadata', handleVideoReady);
    video.addEventListener('resize', handleVideoReady);

    return () => {
      video.removeEventListener('loadedmetadata', handleVideoReady);
      video.removeEventListener('resize', handleVideoReady);
    };
  }, [deviceId, onVideoDimensionsChange]);

  useImperativeHandle(ref, () => ({
    getScreenshot: async (width, height, options = {}) => {
      const videoEl = getVideoEl();
      const containerEl = containerRef.current;
      const filterCss = filters[selectedFilter] || filters.normal;
      const { overlayCanvas = null, native = false, settleMs = 100 } = options;

      if (native || (!width && !height)) {
        return captureNativeFrame(videoEl, {
          filterCss,
          mirrored,
          overlayCanvas,
          settleMs,
        });
      }

      const overlayStyle = getOverlayStyle(detectedFace, videoEl, containerEl);
      const outputWidth = width || videoEl?.videoWidth || 640;
      const outputHeight = height || videoEl?.videoHeight || 480;

      return getFilteredScreenshot(
        videoEl,
        filterCss,
        outputWidth,
        outputHeight,
        overlayImage,
        overlayStyle,
        mirrored,
        settleMs
      );
    },
    captureNative: async (options = {}) => {
      const videoEl = getVideoEl();
      const filterCss = filters[selectedFilter] || filters.normal;
      return captureNativeFrame(videoEl, {
        filterCss,
        mirrored,
        ...options,
      });
    },
    captureBooth: async (options = {}) => {
      const videoEl = getVideoEl();
      const filterCss = filters[selectedFilter] || filters.normal;
      return captureBoothFrame(videoEl, {
        filterCss,
        mirrored,
        ...options,
      });
    },
    getVideoElement: () => getVideoEl(),
    getContainerElement: () => containerRef.current,
  }));

  const videoEl = getVideoEl();
  const overlayStyle = getOverlayStyle(detectedFace, videoEl, containerRef.current);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <button
        type="button"
        className="fullscreen-btn"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        ⛶
      </button>
      {onSwitchCamera && (
        <button
          type="button"
          className="icon-btn camera-switch-btn"
          onClick={onSwitchCamera}
          aria-label="Switch camera"
        >
          ⇄
        </button>
      )}
      <Webcam
        ref={internalWebcamRef}
        audio={false}
        screenshotFormat="image/jpeg"
        className="camera-webcam"
        videoConstraints={getVideoConstraints()}
        onUserMedia={handleUserMedia}
        onLoadedMetadata={handleVideoReady}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: isFullscreen ? '0' : '20px',
          objectFit: 'cover',
          transform: mirrored ? 'scaleX(-1)' : 'none',
          filter: filters[selectedFilter] || filters.normal,
        }}
      />
      <RetroFrameOverlay frameId={frameId} index={frameIndex} />
      {overlayImage && detectedFace && overlayStyle && (
        <img src={overlayImage} alt="face filter" style={overlayStyle} />
      )}
    </div>
  );
});

export default Camera;