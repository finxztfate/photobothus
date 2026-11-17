import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { useAuth } from '../utils/auth';
import ConfirmModal from '../components/ConfirmModal';
import './Gallery.css';

const EMPTY_DETAILS = {
  quote: '',
  location: '',
  filter: '',
  layout: '',
  frames: '',
  camera: '',
  device: '',
  edition: '',
};

const DETAIL_FIELDS = [
  ['quote', 'Quote', 'textarea', 'A short line about this strip'],
  ['location', 'Location', 'text', 'City or venue'],
  ['filter', 'Filter used', 'text', 'Filter name'],
  ['layout', 'Layout', 'text', 'Strip layout'],
  ['frames', 'Frames', 'number', '4'],
  ['camera', 'Camera', 'text', 'Front or back'],
  ['device', 'Device', 'text', 'Phone or camera'],
  ['edition', 'Edition', 'text', 'No. 1'],
];

function MyGallery() {
  const { isAuthenticated, loading } = useAuth();
  const [strips, setStrips] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState(null);
  const [formError, setFormError] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest('/api/strips');
        if (cancelled) return;
        setStrips(data.strips || []);
        setNextCursor(data.hasMore ? data.nextCursor : null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await apiRequest(`/api/strips?before=${nextCursor}`);
      setStrips((prev) => {
        const known = new Set(prev.map((s) => s.id));
        return [...prev, ...(data.strips || []).filter((s) => !known.has(s.id))];
      });
      setNextCursor(data.hasMore ? data.nextCursor : null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const openSpotlight = (strip) => {
    const saved = strip.spotlightDetails || {};
    setFormError('');
    setDraft({
      id: strip.id,
      ...EMPTY_DETAILS,
      ...saved,
      frames: saved.frames ?? '',
      layout: saved.layout || strip.title || '',
    });
  };

  const submitSpotlight = async (event) => {
    event.preventDefault();
    if (!draft) return;
    const missing = DETAIL_FIELDS.find(([key]) => String(draft[key] ?? '').trim() === '');
    if (missing) {
      setFormError(`${missing[1]} is required`);
      return;
    }
    const frames = Number(draft.frames);
    if (!Number.isInteger(frames) || frames < 1 || frames > 12) {
      setFormError('Frames must be a number from 1 to 12');
      return;
    }
    setBusyId(draft.id);
    setFormError('');
    try {
      const data = await apiRequest(`/api/strips/${draft.id}`, {
        method: 'PATCH',
        body: {
          spotlightOptIn: true,
          details: {
            quote: draft.quote.trim(),
            location: draft.location.trim(),
            filter: draft.filter.trim(),
            layout: draft.layout.trim(),
            frames,
            camera: draft.camera.trim(),
            device: draft.device.trim(),
            edition: draft.edition.trim(),
          },
        },
      });
      setStrips((prev) => prev.map((item) => (
        item.id === draft.id
          ? { ...item, spotlightOptIn: true, spotlightDetails: data.spotlightDetails }
          : item
      )));
      setDraft(null);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const removeSpotlight = async (strip) => {
    setBusyId(strip.id);
    setError('');
    try {
      await apiRequest(`/api/strips/${strip.id}`, {
        method: 'PATCH',
        body: { spotlightOptIn: false },
      });
      setStrips((prev) => prev.map((item) => (
        item.id === strip.id ? { ...item, spotlightOptIn: false } : item
      )));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleSelected = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmDelete = async () => {
    const ids = pendingDelete || [];
    setPendingDelete(null);
    if (!ids.length) return;
    setBusyId('delete');
    setError('');
    try {
      await apiRequest('/api/strips', { method: 'DELETE', body: { ids } });
      const gone = new Set(ids);
      setStrips((prev) => prev.filter((strip) => !gone.has(strip.id)));
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="gallery-page"><p>Loading…</p></div>;
  if (!isAuthenticated) {
    return (
      <div className="gallery-page">
        <div className="gallery-empty">
          <h1>My Gallery</h1>
          <p>Log in to see strips saved to your account.</p>
          <Link to="/login">Log in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="gallery-page">
      <header className="gallery-header">
        <h1>My Gallery</h1>
        <p>Strips saved to your account (not tied to an event).</p>
      </header>
      {error && <p className="gallery-error">{error}</p>}
      {strips.length > 0 && (
        <div className="gallery-select-bar">
          <label>
            <input
              type="checkbox"
              checked={strips.every((strip) => selected.has(strip.id))}
              onChange={(event) => {
                if (event.target.checked) setSelected(new Set(strips.map((strip) => strip.id)));
                else setSelected(new Set());
              }}
            />
            Select all
          </label>
          <button
            type="button"
            onClick={() => setPendingDelete([...selected])}
            disabled={!selected.size || busyId === 'delete'}
          >
            Delete selected{selected.size ? ` (${selected.size})` : ''}
          </button>
        </div>
      )}
      {strips.length === 0 ? (
        <div className="gallery-empty">
          <p>No saved strips yet.</p>
          <Link to="/layouts">Start Photobooth</Link>
        </div>
      ) : (
        <div className="gallery-grid">
          {strips.map((strip) => (
            <article key={strip.id} className={`gallery-card${selected.has(strip.id) ? ' is-selected' : ''}`}>
              <label className="gallery-select">
                <input
                  type="checkbox"
                  checked={selected.has(strip.id)}
                  onChange={() => toggleSelected(strip.id)}
                  aria-label={`Select ${strip.title || 'strip'}`}
                />
              </label>
              <img src={strip.imageUrl} alt={strip.title || 'Saved strip'} />
              <div className="gallery-card-meta">
                <span>{strip.title || 'Untitled'}</span>
                <div className="gallery-card-actions">
                  <button
                    type="button"
                    onClick={() => (strip.spotlightOptIn ? removeSpotlight(strip) : openSpotlight(strip))}
                    disabled={busyId === strip.id}
                    aria-pressed={!!strip.spotlightOptIn}
                  >
                    {strip.spotlightOptIn ? 'On Spotlight' : 'Allow on Spotlight'}
                  </button>
                  <button type="button" onClick={() => setPendingDelete([strip.id])} disabled={busyId === 'delete'}>
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {draft && (
        <div className="spotlight-modal-backdrop" onClick={() => setDraft(null)}>
          <form
            className="spotlight-modal"
            role="dialog"
            aria-labelledby="spotlight-modal-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={submitSpotlight}
          >
            <h2 id="spotlight-modal-title">Allow on Spotlight</h2>
            <p>These details are shown with the strip if an admin features it.</p>
            {DETAIL_FIELDS.map(([key, label, type, hint]) => (
              <label key={key}>
                {label}
                {type === 'textarea' ? (
                  <textarea
                    value={draft[key]}
                    onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))}
                    rows={3}
                    placeholder={hint}
                    required
                  />
                ) : (
                  <input
                    type={type}
                    min={type === 'number' ? 1 : undefined}
                    max={type === 'number' ? 12 : undefined}
                    value={draft[key]}
                    onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))}
                    placeholder={hint}
                    required
                  />
                )}
              </label>
            ))}
            {formError && <p className="gallery-error">{formError}</p>}
            <div className="spotlight-modal-actions">
              <button type="button" onClick={() => setDraft(null)}>Cancel</button>
              <button type="submit" disabled={busyId === draft.id}>
                {busyId === draft.id ? 'Saving…' : 'Allow on Spotlight'}
              </button>
            </div>
          </form>
        </div>
      )}
      {pendingDelete && (
        <ConfirmModal
          title={pendingDelete.length === 1 ? 'Delete this photo?' : `Delete ${pendingDelete.length} photos?`}
          message={pendingDelete.length === 1
            ? 'Are you sure? This permanently deletes the photo and its file.'
            : `Are you sure? This permanently deletes ${pendingDelete.length} photos and their files.`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
      {nextCursor && (
        <div className="gallery-more">
          <button type="button" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

export default MyGallery;
