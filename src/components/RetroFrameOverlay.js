import { useEffect, useRef } from 'react';
import { drawRetroFrame, ensureRetroFrameFonts } from '../utils/retroFrames';
import './RetroFrameOverlay.css';

export default function RetroFrameOverlay({ frameId, index = 0 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frameId) return undefined;
    let cancelled = false;

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drawRetroFrame(ctx, frameId, { x: 0, y: 0, w, h }, { index });
    };

    draw();
    ensureRetroFrameFonts().then(() => {
      if (!cancelled) draw();
    });

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(draw) : null;
    observer?.observe(canvas);

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [frameId, index]);

  if (!frameId) return null;
  return <canvas ref={canvasRef} className="retro-frame-overlay" aria-hidden="true" />;
}
