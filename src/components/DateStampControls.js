import { useEffect, useRef, useState } from 'react';
import { getDateStampText } from '../utils/stripCompositor';

export const DATE_SIZE_OPTIONS = [
  { value: 10, label: 'Small', short: 'S' },
  { value: 12, label: 'Medium', short: 'M' },
  { value: 14, label: 'Large', short: 'L' },
  { value: 16, label: 'XL', short: 'XL' },
  { value: 18, label: '2XL', short: '2XL' },
  { value: 20, label: '3XL', short: '3XL' },
];

const DATE_COLOR_PRESETS = ['#E8A33D', '#FF8A1E', '#FFFFFF', '#F3E2C5', '#C8551B', '#16120C'];

export const DEFAULT_DATE_FONT = '"Special Elite", cursive';

export const DATE_FONT_OPTIONS = [
  { id: '"Special Elite", cursive', name: 'Typewriter' },
  { id: '"Courier Prime", monospace', name: 'Courier' },
  { id: '"Playfair Display", serif', name: 'Classic Serif' },
  { id: '"Bebas Neue", sans-serif', name: 'Retro Poster' },
  { id: '"Rye", serif', name: 'Western' },
  { id: '"Abril Fatface", serif', name: 'Vintage Display' },
  { id: 'Limelight, cursive', name: 'Art Deco' },
  { id: 'Fredoka, sans-serif', name: 'Retro Rounded' },
];

/** Map legacy saved values (under/bottom) to current placement ids. */
export function normalizeDatePlacement(value) {
  if (value === 'under' || value === 'belowPhotos') return 'belowPhotos';
  if (value === 'bottom' || value === 'footerBar') return 'footerBar';
  return 'belowPhotos';
}

export default function DateStampControls({
  enabled,
  onEnabledChange,
  size,
  onSizeChange,
  color,
  onColorPreview,
  onColorCommit,
  font,
  onFontChange,
}) {
  const [draftColor, setDraftColor] = useState(color);
  const draftColorRef = useRef(color);

  useEffect(() => {
    setDraftColor(color);
    draftColorRef.current = color;
  }, [color]);

  const colorPreviewRafRef = useRef(null);

  useEffect(() => () => {
    if (colorPreviewRafRef.current) {
      cancelAnimationFrame(colorPreviewRafRef.current);
    }
  }, []);

  const handleColorInput = (hex) => {
    draftColorRef.current = hex;
    setDraftColor(hex);
    if (!onColorPreview) return;
    if (colorPreviewRafRef.current) return;
    colorPreviewRafRef.current = requestAnimationFrame(() => {
      colorPreviewRafRef.current = null;
      onColorPreview(draftColorRef.current);
    });
  };

  const commitColor = () => {
    onColorCommit?.(draftColorRef.current);
  };

  const pickPresetColor = (hex) => {
    draftColorRef.current = hex;
    setDraftColor(hex);
    onColorCommit?.(hex);
  };

  const isPresetColor = DATE_COLOR_PRESETS.some((hex) => hex.toLowerCase() === String(draftColor).toLowerCase());

  return (
    <div className="edit-panel edit-panel--date-stamp">
      <div className="date-stamp-header">
        <div>
          <h4>Date stamp</h4>
          <p className="date-stamp-sub">Add today&apos;s date to your strip</p>
        </div>
        <label className="date-switch">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            aria-label="Show date stamp"
          />
          <span className="date-switch-track" aria-hidden="true" />
        </label>
      </div>

      {enabled && (
        <div className="date-stamp-options">
          <div className="date-stamp-field">
            <span className="date-stamp-label">Size</span>
            <div className="date-segmented" role="radiogroup" aria-label="Date text size">
              {DATE_SIZE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={size === option.value}
                  className={size === option.value ? 'active' : ''}
                  onClick={() => onSizeChange(option.value)}
                  aria-label={`${option.label} text size`}
                  title={option.label}
                >
                  {option.short}
                </button>
              ))}
            </div>
          </div>

          <div className="date-stamp-field">
            <span className="date-stamp-label">Color</span>
            <div className="date-color-row">
              {DATE_COLOR_PRESETS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className={`date-color-dot${hex.toLowerCase() === String(draftColor).toLowerCase() ? ' active' : ''}`}
                  style={{ background: hex }}
                  onClick={() => pickPresetColor(hex)}
                  aria-label={`Date color ${hex}`}
                />
              ))}
              <label
                className={`date-color-dot date-color-dot--custom${isPresetColor ? '' : ' active'}`}
                style={isPresetColor ? undefined : { background: draftColor }}
                title="Pick any color"
              >
                <input
                  type="color"
                  value={draftColor}
                  onChange={(e) => handleColorInput(e.target.value)}
                  onMouseUp={commitColor}
                  onTouchEnd={commitColor}
                  onBlur={commitColor}
                  aria-label="Custom date stamp color"
                />
              </label>
            </div>
          </div>

          <div className="date-stamp-field">
            <span className="date-stamp-label">Typeface</span>
            <div className="date-font-grid" role="radiogroup" aria-label="Date typeface">
              {DATE_FONT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={font === option.id}
                  className={`date-font-chip${font === option.id ? ' active' : ''}`}
                  onClick={() => onFontChange(option.id)}
                >
                  <span className="date-font-sample" style={{ fontFamily: option.id }}>{getDateStampText()}</span>
                  <span className="date-font-name">{option.name}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="date-stamp-hint">Tip: drag the date on your strip to move it.</p>
        </div>
      )}
    </div>
  );
}
