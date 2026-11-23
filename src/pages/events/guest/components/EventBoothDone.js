function EventBoothDone({ onClose, onTakeAnother }) {
  return (
    <div className="event-booth-review event-booth-done">
      <p className="event-booth-progress">Saved</p>
      <h2 className="event-booth-done-title">Your photos are with the host.</h2>
      <p className="event-booth-review-hint">
        They’re stored on this event. The host can download them after the event ends.
      </p>
      <div className="event-booth-review-actions">
        <button type="button" className="event-booth-secondary" onClick={onClose}>
          Close
        </button>
        <button type="button" className="event-booth-primary" onClick={onTakeAnother}>
          Take another
        </button>
      </div>
    </div>
  );
}

export default EventBoothDone;
