import { useEffect, useState, useRef } from 'react';
import * as faceapi from '@vladmandic/face-api';

const MODEL_URL = '/models';

const useFaceDetection = (videoRef, options = {}) => {
  const [faces, setFaces] = useState([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const detectionInterval = useRef(null);

  const {
    detectionIntervalMs = 300,
    enableDetection = true,
  } = options;

  useEffect(() => {
    let isCancelled = false;

    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);
        if (!isCancelled) {
          setModelsLoaded(true);
          setLoading(false);
          console.log('Face detection models loaded from:', MODEL_URL);
        }
      } catch (err) {
        const detail = err?.message || err;
        console.error('Face detection model load failed:', detail, err);
        if (!isCancelled) {
          setError('Model load failed: ' + detail);
          setLoading(false);
        }
      }
    };

    loadModels();

    return () => {
      isCancelled = true;
      if (detectionInterval.current) {
        clearInterval(detectionInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!modelsLoaded || !enableDetection) {
      return;
    }

    let isCancelled = false;

    const getVideoElement = () => {
      if (!videoRef?.current) return null;

      const instance = videoRef.current;

      if (instance instanceof HTMLVideoElement && instance.videoWidth && instance.videoHeight) {
        return instance;
      }

      if (typeof instance.getVideoElement === 'function') {
        const el = instance.getVideoElement();
        if (el instanceof HTMLVideoElement && el.videoWidth && el.videoHeight) return el;
      }

      if (instance.video instanceof HTMLVideoElement && instance.video.videoWidth && instance.video.videoHeight) {
        return instance.video;
      }

      if (typeof instance.querySelector === 'function') {
        const el = instance.querySelector('video');
        if (el instanceof HTMLVideoElement && el.videoWidth && el.videoHeight) return el;
      }

      return null;
    };

    const detectFaces = async () => {
      try {
        const videoEl = getVideoElement();
        if (!videoEl) return;

        if (videoEl.readyState < 2) return;

        if (!videoEl.videoWidth || !videoEl.videoHeight) return;

        let detections;
        try {
          detections = await faceapi
            .detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks();
        } catch {
          detections = [];
        }

        if (!isCancelled && Array.isArray(detections)) {
          const validDetections = detections.filter(d => 
            d?.detection?.box && 
            typeof d.detection.box.x === 'number' && 
            typeof d.detection.box.y === 'number' && 
            typeof d.detection.box.width === 'number' && 
            typeof d.detection.box.height === 'number'
          );
          setFaces(validDetections);
        }
      } catch (err) {
        console.error('Face detection runtime error:', err);
        if (!isCancelled) {
          setError('Detection error: ' + (err?.message || err));
        }
      }
    };

    isCancelled = false;
    detectionInterval.current = setInterval(detectFaces, detectionIntervalMs);

    return () => {
      isCancelled = true;
      if (detectionInterval.current) {
        clearInterval(detectionInterval.current);
      }
    };
  }, [modelsLoaded, enableDetection, videoRef, detectionIntervalMs]);

  return { faces, modelsLoaded, loading, error };
};

export default useFaceDetection;