import { bgColorPresets } from '../../../../data/editorBackgrounds';
import BackgroundStripPicker from '../../../../components/BackgroundStripPicker';
import DateStampControls from '../../../../components/DateStampControls';
import DraggableStripPreview from '../../../../components/DraggableStripPreview';
import CustomFrameModal from '../../../../components/CustomFrameModal';
import { enterMobileFullscreen } from '../../../../utils/mobileFullscreen';

function EventEditorLookView({
  isHostEditor,
  layoutId,
  layoutName,
  capturedPhotos,
  strip,
  isGenerating,
  showDate,
  dateX,
  dateY,
  dateSize,
  dateColor,
  dateFont,
  onDatePositionChange,
  frameBackgroundStyle,
  customBg,
  customPickerHex,
  onBackgroundSelect,
  onCustomColorPreview,
  onCustomColorCommit,
  onShowDateChange,
  onDateSizeChange,
  onDateColorPreview,
  onDateColorCommit,
  onDateFontChange,
  isCustomModalOpen,
  previewStrip,
  customFramePreview,
  onSelectFrame,
  onApplyFrame,
  onCloseFrame,
  onOpenFrame,
  statusLabel,
  saveStatus,
  error,
}) {
  return (
    <>
      <div className="edit-hero">
        <p className="hero-eyebrow">{isHostEditor ? 'HOST STRIP' : 'YOUR STRIP'}</p>
        <h1 className="edit-hero-title">{isHostEditor ? 'Customize look' : 'Your strip'}</h1>
        <p className="edit-hero-subtitle">
          {layoutName} · This look applies to every guest strip
        </p>
      </div>

      {statusLabel && (
        <p className={`event-editor-status${saveStatus === 'error' ? ' is-error' : ''}`}>{statusLabel}</p>
      )}
      {error && saveStatus !== 'error' && <p className="event-editor-status is-error">{error}</p>}

      {isCustomModalOpen && (
        <CustomFrameModal
          layoutId={layoutId}
          previewStrip={previewStrip}
          canApply={Boolean(customFramePreview)}
          onSelect={onSelectFrame}
          onApply={onApplyFrame}
          onClose={onCloseFrame}
        />
      )}

      <div className="edit-body">
        <section className="edit-result" aria-label="Your strip">
          {capturedPhotos.length === 0 ? (
            <p className="edit-empty">No photos captured yet.</p>
          ) : strip ? (
            <DraggableStripPreview
              stripSrc={strip}
              layoutId={layoutId}
              showDate={showDate}
              dateX={dateX}
              dateY={dateY}
              onDatePositionChange={onDatePositionChange}
              dateSize={dateSize}
              dateColor={dateColor}
              dateFont={dateFont}
              backgroundStyle={frameBackgroundStyle}
              isUpdating={isGenerating}
            />
          ) : (
            <p className="edit-empty">Preparing your strip…</p>
          )}
          {isGenerating && !strip && <p className="edit-status">Preparing your strip…</p>}
        </section>

        <aside className="edit-controls">
          <div className="edit-panel">
            <h4>Background</h4>
            <BackgroundStripPicker
              layoutId={layoutId}
              presets={bgColorPresets}
              selectedBg={customBg}
              customColorHex={customPickerHex}
              onSelect={onBackgroundSelect}
              onCustomColorPreview={onCustomColorPreview}
              onCustomColorCommit={onCustomColorCommit}
            />
          </div>

          <DateStampControls
            enabled={showDate}
            onEnabledChange={onShowDateChange}
            size={dateSize}
            onSizeChange={onDateSizeChange}
            color={dateColor}
            onColorPreview={onDateColorPreview}
            onColorCommit={onDateColorCommit}
            font={dateFont}
            onFontChange={onDateFontChange}
          />

          <div className="edit-panel edit-panel--custom">
            <h4>Custom frame</h4>
            <p>Upload your own border artwork as a PNG background.</p>
            <button
              type="button"
              className="custom-frame-btn"
              onClick={() => {
                onOpenFrame();
                enterMobileFullscreen();
              }}
            >
              Upload frame
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}

export default EventEditorLookView;
