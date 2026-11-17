import { useEffect, useRef, useState } from 'react';
import {
  buildCustomGradient,
  getBackgroundPreviewStyle,
  getBorderForBackground,
} from '../data/editorBackgrounds';

const CUSTOM_SWATCH_IDLE = 'conic-gradient(from 210deg, #ff6b6b, #ffd93d, #6bcb77, #4d96ff, #b48cff, #ff6b6b)';

export default function BackgroundStripPicker({
  presets,
  selectedBg,
  customColorHex = '#000000',
  onSelect,
  onCustomColorPreview,
  onCustomColorCommit,
}) {
  const presetValues = new Set(presets.map((p) => p.value));
  const isCustomSelected =
    typeof selectedBg === 'string' && !presetValues.has(selectedBg) && !selectedBg.startsWith('data:image');

  const [draftHex, setDraftHex] = useState(customColorHex);
  const draftHexRef = useRef(customColorHex);
  const previewRafRef = useRef(null);

  useEffect(() => {
    setDraftHex(customColorHex);
    draftHexRef.current = customColorHex;
  }, [customColorHex]);

  useEffect(() => () => {
    if (previewRafRef.current) {
      cancelAnimationFrame(previewRafRef.current);
    }
  }, []);

  const commitCustomColor = (hex) => {
    onCustomColorCommit(hex, buildCustomGradient(hex), hex);
  };

  const handleCustomColorInput = (hex) => {
    draftHexRef.current = hex;
    setDraftHex(hex);
    if (!onCustomColorPreview) return;
    if (previewRafRef.current) return;
    previewRafRef.current = requestAnimationFrame(() => {
      previewRafRef.current = null;
      onCustomColorPreview(draftHexRef.current);
    });
  };

  const flushCustomColor = () => {
    commitCustomColor(draftHexRef.current);
  };

  return (
    <div className="bg-swatch-grid" role="listbox" aria-label="Background options">
      {presets.map((preset) => {
        const active = selectedBg === preset.value;
        return (
          <button
            key={preset.id}
            type="button"
            role="option"
            aria-selected={active}
            aria-label={preset.name}
            title={preset.name}
            className={`bg-swatch${active ? ' active' : ''}`}
            onClick={() => onSelect(preset.value, getBorderForBackground(preset.value))}
          >
            <span className="bg-swatch-fill" style={getBackgroundPreviewStyle(preset.value)} />
            <span className="bg-swatch-label">{preset.name}</span>
          </button>
        );
      })}

      <label className={`bg-swatch bg-swatch--custom${isCustomSelected ? ' active' : ''}`} title="Pick any color">
        <span
          className="bg-swatch-fill"
          style={{ background: isCustomSelected ? buildCustomGradient(draftHex) : CUSTOM_SWATCH_IDLE }}
        >
          <span className="bg-swatch-plus" aria-hidden="true">+</span>
        </span>
        <span className="bg-swatch-label">Custom</span>
        <input
          type="color"
          className="bg-swatch-color-input"
          value={draftHex}
          onChange={(e) => handleCustomColorInput(e.target.value)}
          onMouseUp={flushCustomColor}
          onTouchEnd={flushCustomColor}
          onBlur={flushCustomColor}
          aria-label="Custom background color"
        />
      </label>
    </div>
  );
}
