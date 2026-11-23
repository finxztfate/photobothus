import { Link } from 'react-router-dom';

function EventBoothReview({
  code,
  photos,
  slotCount,
  isSaving,
  saveError,
  onRetake,
  onRetakeAll,
  onSend,
}) {
  return (
    <div className="event-booth-review">
      <div className="event-booth-topbar">
        <Link to={`/e/${code}/layouts`} className="event-booth-back">
          Back
        </Link>
        <p className="event-booth-progress">Looks good?</p>
        <span className="event-booth-top-spacer" />
      </div>
      <p className="event-booth-review-hint">Tap a shot to retake just that frame.</p>
      <div className={`event-booth-review-grid ${slotCount <= 2 ? 'is-few' : ''}`}>
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            className="event-booth-review-shot"
            onClick={() => onRetake(index)}
          >
            <img src={photo.src} alt={`Shot ${index + 1}`} />
            <span>Retake {index + 1}</span>
          </button>
        ))}
      </div>
      {saveError && <p className="event-booth-error">{saveError}</p>}
      <div className="event-booth-review-actions">
        <button type="button" className="event-booth-secondary" onClick={onRetakeAll} disabled={isSaving}>
          Retake all
        </button>
        <button
          type="button"
          className="event-booth-primary"
          disabled={photos.length < slotCount || isSaving}
          onClick={onSend}
        >
          {saveError ? 'Try again' : 'Send to event'}
        </button>
      </div>
      {isSaving && (
        <div className="event-booth-save-overlay" role="status" aria-live="polite">
          <div className="event-booth-save-spinner" />
          <p>Saving your strip to the event…</p>
        </div>
      )}
    </div>
  );
}

export default EventBoothReview;
