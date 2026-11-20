import { useCallback, useEffect, useState } from 'react';
import { getLayoutById, getStripPrintSize } from '../data/stripLayouts';
import { exitMobileFullscreen } from '../utils/mobileFullscreen';
import './CustomFrameModal.css';

function readImageFile(file, onLoad) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => onLoad(reader.result, file.name);
  reader.readAsDataURL(file);
}

function CustomFrameModal({
  layoutId,
  previewStrip,
  canApply,
  onSelect,
  onApply,
  onClose,
}) {
  const layout = getLayoutById(layoutId);
  const size = getStripPrintSize(layout.id);
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);

  const close = useCallback(() => {
    exitMobileFullscreen();
    onClose();
  }, [onClose]);

  const apply = () => {
    onApply();
    exitMobileFullscreen();
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close]);

  const takeFile = (file) => {
    readImageFile(file, (dataUrl, name) => {
      setFileName(name);
      onSelect(dataUrl);
    });
  };

  return (
    <div className="frame-modal" role="dialog" aria-modal="true" aria-labelledby="frame-modal-title" onClick={close}>
      <div className="frame-modal-card" onClick={(event) => event.stopPropagation()}>
        <header className="frame-modal-head">
          <div>
            <p className="frame-modal-kicker">Custom artwork</p>
            <h2 id="frame-modal-title">Add a frame</h2>
          </div>
          <button type="button" className="frame-modal-x" onClick={close} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="frame-modal-body">
          <div className="frame-modal-preview">
            {previewStrip ? (
              <img src={previewStrip} alt="Strip preview with custom frame" />
            ) : (
              <div className="frame-modal-placeholder">
                <span>Your strip preview</span>
                <small>Choose a PNG to see it on this layout</small>
              </div>
            )}
          </div>

          <div className="frame-modal-copy">
            <div className="frame-modal-size">
              <span>This layout</span>
              <strong>{layout.name}</strong>
              <em>{size.widthPx} × {size.heightPx}px</em>
              <small>{size.label} · {size.dpi} DPI</small>
            </div>

            <label
              className={`frame-modal-drop${dragging ? ' is-dragging' : ''}${fileName ? ' has-file' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                takeFile(event.dataTransfer.files[0]);
              }}
            >
              <input
                type="file"
                accept="image/png,image/*"
                onChange={(event) => {
                  takeFile(event.target.files[0]);
                  event.target.value = '';
                }}
              />
              <strong>{fileName || 'Drop a PNG here'}</strong>
              <span>{fileName ? 'Click to choose a different file' : 'or click to browse'}</span>
            </label>

            <ul className="frame-modal-tips">
              <li>PNG with a transparent hole for the photos</li>
              <li>Match this layout’s pixel size</li>
              <li>Keep important art inside the edges</li>
            </ul>
          </div>
        </div>

        <footer className="frame-modal-foot">
          <button type="button" className="frame-modal-cancel" onClick={close}>
            Cancel
          </button>
          <button type="button" className="frame-modal-apply" onClick={apply} disabled={!canApply}>
            Use this frame
          </button>
        </footer>
      </div>
    </div>
  );
}

export default CustomFrameModal;
