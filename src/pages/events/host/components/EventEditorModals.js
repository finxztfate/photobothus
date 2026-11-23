import { createPortal } from 'react-dom';

export function EventLimitModal({ open, maxGuestUploads, guestUploadCount, onDone }) {
  if (!open) return null;
  return createPortal(
    <div className="edit-download-modal" role="dialog" aria-modal="true" aria-labelledby="limit-modal-title">
      <div className="edit-download-modal-card">
        <h2 id="limit-modal-title">Upload limit reached</h2>
        <p>
          You’ve used all <strong>{maxGuestUploads}</strong> uploads for this event
          ({guestUploadCount}/{maxGuestUploads}).
        </p>
        <p>Thanks for sharing your moments!</p>
        <div className="custom-modal-actions">
          <button type="button" className="edit-download" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function EventDoneModal({ open, onTakeAnother, onClose }) {
  if (!open) return null;
  return createPortal(
    <div className="edit-download-modal" role="dialog" aria-modal="true" aria-labelledby="done-modal-title">
      <div className="edit-download-modal-card">
        <h2 id="done-modal-title">Your photos are with the host.</h2>
        <p>They’re saved to this event. The host can download them after the event ends.</p>
        <div className="custom-modal-actions">
          <button type="button" className="edit-download" onClick={onTakeAnother}>
            Take another
          </button>
          <button type="button" className="edit-modal-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
