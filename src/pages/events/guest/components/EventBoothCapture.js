import { Link } from 'react-router-dom';
import Camera from '../../../../components/Camera';
import LayoutPreview from '../../../../components/LayoutPreview';

const LIVE_FILTERS = ['normal', 'bwfilm', 'vintage', 'seventies'];

function liveFilterLabel(id) {
  if (id === 'bwfilm') return 'B&W';
  if (id === 'seventies') return 'Warm';
  if (id === 'normal') return 'Original';
  if (id === 'vintage') return 'Vintage';
  return id;
}

function EventBoothCapture({
  code,
  layout,
  layoutName,
  slotCount,
  shotNumber,
  canCapture,
  capturedPhotos,
  retakeIndex,
  isCapturing,
  countdown,
  timerLabel,
  onCycleTimer,
  selectedFilter,
  onFilterChange,
  cameraError,
  onCameraError,
  flash,
  availableCameras,
  selectedCamera,
  onSwitchCamera,
  mirrored,
  onToggleMirror,
  finderAspect,
  onFinderAspect,
  cameraRef,
  onShutter,
  onReview,
  onRetakeIndex,
}) {
  return (
    <>
      <div className="event-booth-topbar">
        <Link to={`/e/${code}/layouts`} className="event-booth-back">
          Back
        </Link>
        <p className="event-booth-progress">
          Photo {shotNumber} of {slotCount}
        </p>
        <div className="event-booth-top-actions">
          {availableCameras.length > 1 && (
            <button type="button" className="event-booth-icon-btn" onClick={onSwitchCamera}>
              Flip
            </button>
          )}
          <button
            type="button"
            className="event-booth-icon-btn is-active"
            onClick={onCycleTimer}
            aria-label={`Timer ${timerLabel}. Cycle instant, 3 seconds, 5 seconds.`}
          >
            {timerLabel}
          </button>
        </div>
      </div>

      <div className="event-booth-stage">
        <div
          className="event-booth-viewfinder"
          style={finderAspect ? { '--finder-aspect': String(finderAspect) } : undefined}
        >
          <Camera
            ref={cameraRef}
            selectedFilter={selectedFilter}
            mirrored={mirrored}
            orientation="portrait"
            objectFit="cover"
            deviceId={selectedCamera}
            onError={onCameraError}
            onVideoDimensionsChange={({ aspect }) => {
              if (aspect > 0) onFinderAspect(aspect);
            }}
            showFullscreenButton={false}
            sharp
          />
          {countdown != null && (
            <div className="event-booth-countdown" aria-live="assertive">{countdown}</div>
          )}
          {flash && <div className="event-booth-flash" />}
          {capturedPhotos.length > 0 && (
            <LayoutPreview
              layout={layout}
              photos={capturedPhotos}
              className="event-booth-strip-preview"
              onPhotoClick={onRetakeIndex}
              activePhotoIndex={retakeIndex ?? capturedPhotos.length}
              emptyLabel
            />
          )}
        </div>
      </div>

      {cameraError && <p className="event-booth-error">{cameraError}</p>}
      {layoutName && <p className="event-booth-layout-name">{layoutName}</p>}

      <div className="event-booth-dock">
        <div className="event-booth-filters" role="tablist" aria-label="Live filters">
          {LIVE_FILTERS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selectedFilter === id}
              className={`event-booth-filter ${selectedFilter === id ? 'is-active' : ''}`}
              onClick={() => onFilterChange(id)}
            >
              {liveFilterLabel(id)}
            </button>
          ))}
        </div>
        <div className="event-booth-shutter-row">
          <button
            type="button"
            className="event-booth-dock-side"
            disabled={capturedPhotos.length === 0}
            onClick={onReview}
          >
            Review shots
          </button>
          <button
            type="button"
            className="event-booth-shutter"
            disabled={isCapturing || countdown != null || !canCapture}
            onClick={onShutter}
            aria-label="Take photo"
          />
          <button
            type="button"
            className={`event-booth-dock-side${mirrored ? ' is-active' : ''}`}
            onClick={onToggleMirror}
            aria-pressed={mirrored}
            aria-label={mirrored ? 'Mirror on' : 'Mirror off'}
          >
            Mirror
          </button>
        </div>
      </div>
    </>
  );
}

export default EventBoothCapture;
