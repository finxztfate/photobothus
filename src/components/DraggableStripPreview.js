import { useCallback, useEffect, useRef, useState } from 'react';
import { computeStripDimensions } from '../data/filterTemplates';
import { getDateStampText } from '../utils/stripCompositor';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function DraggableStripPreview({
  stripSrc,
  layoutId,
  showDate,
  dateX,
  dateY,
  onDatePositionChange,
  dateSize,
  dateColor,
  dateFont,
  backgroundStyle,
  isUpdating = false,
}) {
  const frameRef = useRef(null);
  const imgRef = useRef(null);
  const [fontScale, setFontScale] = useState(1);
  const [dragging, setDragging] = useState(false);

  const updateFontScale = useCallback(() => {
    const img = imgRef.current;
    if (!img?.naturalHeight) return;
    setFontScale(img.clientHeight / img.naturalHeight);
  }, []);

  useEffect(() => {
    updateFontScale();
    const img = imgRef.current;
    if (!img) return undefined;

    if (img.complete) updateFontScale();

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateFontScale)
      : null;

    observer?.observe(img);
    window.addEventListener('resize', updateFontScale);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateFontScale);
    };
  }, [stripSrc, updateFontScale]);

  const pointToNormalized = useCallback((clientX, clientY) => {
    const frame = frameRef.current;
    if (!frame) return null;

    const rect = frame.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    return {
      x: clamp((clientX - rect.left) / rect.width, 0.04, 0.96),
      y: clamp((clientY - rect.top) / rect.height, 0.04, 0.96),
    };
  }, []);

  const handlePointerDown = (event) => {
    event.preventDefault();
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragging) return;
    const next = pointToNormalized(event.clientX, event.clientY);
    if (!next) return;
    onDatePositionChange(next.x, next.y, { live: true });
  };

  const finishDrag = (event) => {
    if (!dragging) return;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const next = pointToNormalized(event.clientX, event.clientY);
    if (next) {
      onDatePositionChange(next.x, next.y, { commit: true });
    } else {
      onDatePositionChange(dateX, dateY, { commit: true });
    }
  };

  const { stripWidth, stripHeight } = computeStripDimensions(layoutId);

  return (
    <div className="edit-strip-frame" ref={frameRef} style={backgroundStyle}>
      <img
        ref={imgRef}
        src={stripSrc}
        alt="Your photobooth strip"
        className={`edit-strip-image${isUpdating ? ' is-updating' : ''}`}
        onLoad={updateFontScale}
      />
      {showDate && (
        <button
          type="button"
          className={`edit-date-stamp-handle${dragging ? ' is-dragging' : ''}`}
          style={{
            left: `${dateX * 100}%`,
            top: `${dateY * 100}%`,
            color: dateColor,
            fontFamily: dateFont,
            fontSize: `${Math.max(8, dateSize * fontScale)}px`,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          aria-label="Drag to reposition date stamp"
        >
          {getDateStampText()}
        </button>
      )}
      <span className="visually-hidden" aria-live="polite">
        Strip size {stripWidth} by {stripHeight} pixels
      </span>
    </div>
  );
}
