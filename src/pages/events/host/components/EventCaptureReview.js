function photoFilterStyle(photo) {
  if (!photo?.filter || photo.filter === 'none') return undefined;
  return { filter: photo.filter };
}

function EventCaptureReview({ capturedPhotos, activePhoto, onSelectPhoto, statusLabel, saveStatus, error }) {
  return (
    <>
      <div className="edit-hero">
        <p className="hero-eyebrow">EVENT PHOTOS</p>
        <h1 className="edit-hero-title">Your captures</h1>
        <p className="edit-hero-subtitle">This look is stored with the event and applies to every guest photo.</p>
      </div>
      {statusLabel && (
        <p className={`event-editor-status${saveStatus === 'error' ? ' is-error' : ''}`}>{statusLabel}</p>
      )}
      {error && <p className="event-editor-status is-error">{error}</p>}
      <div className="event-capture-body">
        <div className="event-capture-hero">
          {activePhoto ? (
            <img src={activePhoto.src} alt="Selected capture" style={photoFilterStyle(activePhoto)} />
          ) : (
            <div className="edit-empty">No photos left — go back to the booth.</div>
          )}
        </div>
        {capturedPhotos.length > 0 && (
          <div className="event-capture-thumbs" aria-label="All captures">
            {capturedPhotos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                className={`event-capture-thumb${photo.id === activePhoto?.id ? ' active' : ''}`}
                onClick={() => onSelectPhoto(photo.id)}
              >
                <img src={photo.src} alt="" style={photoFilterStyle(photo)} />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default EventCaptureReview;
