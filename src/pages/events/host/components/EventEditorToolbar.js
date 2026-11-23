function EventEditorToolbar({ isHostEditor, onDownload, onDone, onClose }) {
  return (
    <header className="edit-toolbar">
      <span className="edit-toolbar-brand">{isHostEditor ? 'Event gallery' : 'Event booth'}</span>
      <div className="edit-toolbar-actions">
        <div className="edit-toolbar-cluster" role="group" aria-label="Save">
          {isHostEditor && (
            <button type="button" className="edit-share edit-export-btn" onClick={onDownload}>
              Download
            </button>
          )}
          <button type="button" className="edit-download edit-export-btn" onClick={onDone}>
            {isHostEditor ? 'Save look' : 'Done'}
          </button>
        </div>
        <button type="button" className="edit-close" onClick={onClose}>
          {isHostEditor ? 'Back to gallery' : 'Back to booth'}
        </button>
      </div>
    </header>
  );
}

export default EventEditorToolbar;
