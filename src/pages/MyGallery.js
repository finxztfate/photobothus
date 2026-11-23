import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { STRIP_LAYOUTS } from '../data/stripLayouts';
import { apiRequest } from '../utils/api';
import { useAuth } from '../utils/auth';
import ConfirmModal from '../components/ConfirmModal';
import './Gallery.css';

const EMPTY_DETAILS = {
  quote: '',
  location: '',
  layout: '',
  device: '',
  socialNetwork: 'instagram',
  social: '',
};

const DETAIL_FIELDS = [
  ['quote', 'Quote', 'textarea', 'A short line about this strip'],
  ['location', 'Location', 'text', 'City or venue'],
  ['layout', 'Layout', 'text', 'Strip layout'],
  ['device', 'Device', 'text', 'Phone or camera'],
];

function layoutName(strip) {
  if (strip?.layoutId == null) return '';
  return STRIP_LAYOUTS.find((layout) => layout.id === strip.layoutId)?.name || '';
}

function stripLabel(strip) {
  return strip?.title || layoutName(strip) || 'Untitled';
}

function formatSavedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function MyGallery() {
  const { isAuthenticated, loading, user } = useAuth();
  const [strips, setStrips] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState(null);
  const [formError, setFormError] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingSpotlightOff, setPendingSpotlightOff] = useState(null);

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
      layout: saved.layout || strip.title || layoutName(strip) || '',
      socialNetwork: saved.socialNetwork === 'facebook' ? 'facebook' : 'instagram',
      social: saved.social || '',
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
    if (!String(draft.social || '').trim()) {
      setFormError('Social is required');
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
            layout: draft.layout.trim(),
            device: draft.device.trim(),
            socialNetwork: draft.socialNetwork === 'facebook' ? 'facebook' : 'instagram',
            social: draft.social.trim(),
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
    if (!strip) return;
    setPendingSpotlightOff(null);
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

  if (loading) return <div className="gallery-page"><p className="gallery-loading">Loading your gallery…</p></div>;
  if (!isAuthenticated) {
    return (
      <div className="gallery-page">
        <div className="gallery-empty">
          <h1>Your gallery</h1>
          <p>Log in to see strips saved to your Photobothus account.</p>
          <Link className="gallery-empty-cta" to="/login">Log in</Link>
        </div>
      </div>
    );
  }

  const spotlightEntry = strips.find((strip) => strip.spotlightOptIn) || null;
  const draftStrip = draft ? strips.find((strip) => strip.id === draft.id) : null;

  return (
    <div className="gallery-page">
      <header className="gallery-header gallery-header--account">
        <div>
          <h1>Your gallery</h1>
          <p>
            {strips.length
              ? `${strips.length} strip${strips.length === 1 ? '' : 's'} saved${user?.displayName ? ` for ${user.displayName.split(' ')[0]}` : ''}.`
              : 'Strips you save from the editor live here — not on your phone.'}
          </p>
        </div>
        <Link className="gallery-header-cta" to="/layouts">Start photobooth</Link>
      </header>
      {error && <p className="gallery-error">{error}</p>}
      {spotlightEntry && (
        <div className="gallery-spotlight-banner">
          <div>
            <strong>This week’s Spotlight entry</strong>
            <p>{stripLabel(spotlightEntry)} — one strip at a time. Remove it to enter a different one.</p>
          </div>
          <button
            type="button"
            onClick={() => setPendingSpotlightOff(spotlightEntry)}
            disabled={busyId === spotlightEntry.id}
          >
            Remove from Spotlight
          </button>
        </div>
      )}
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
            className="gallery-select-delete"
            onClick={() => setPendingDelete([...selected])}
            disabled={!selected.size || busyId === 'delete'}
          >
            Delete selected{selected.size ? ` (${selected.size})` : ''}
          </button>
        </div>
      )}
      {strips.length === 0 ? (
        <div className="gallery-empty">
          <h2>No strips yet</h2>
          <p>
            After you shoot, tap <strong>Save strip</strong> in the editor. Event booth photos
            stay on the Event Dashboard.
          </p>
          <Link className="gallery-empty-cta" to="/layouts">Start photobooth</Link>
        </div>
      ) : (
        <div className="gallery-grid">
          {strips.map((strip) => {
            const inSpotlight = !!strip.spotlightOptIn;
            const blocked = !inSpotlight && spotlightEntry != null;
            return (
              <article
                key={strip.id}
                className={`gallery-card${selected.has(strip.id) ? ' is-selected' : ''}${inSpotlight ? ' is-spotlight' : ''}`}
              >
                <label className="gallery-select">
                  <input
                    type="checkbox"
                    checked={selected.has(strip.id)}
                    onChange={() => toggleSelected(strip.id)}
                    aria-label={`Select ${strip.title || 'strip'}`}
                  />
                </label>
                {inSpotlight && <span className="gallery-spotlight-badge">Spotlight</span>}
                <div className="gallery-strip-mat">
                  <div className="gallery-strip-frame">
                    <img src={strip.imageUrl} alt={strip.title || 'Saved strip'} />
                  </div>
                </div>
                <div className="gallery-card-meta">
                  <div className="gallery-card-copy">
                    <span className="gallery-card-title">{stripLabel(strip)}</span>
                    <span className="gallery-card-hint">
                      {blocked ? 'One entry already in' : formatSavedAt(strip.createdAt)}
                    </span>
                  </div>
                  <div className="gallery-card-actions">
                    <button
                      type="button"
                      className={inSpotlight ? 'gallery-btn-spotlight' : undefined}
                      onClick={() => (inSpotlight ? setPendingSpotlightOff(strip) : openSpotlight(strip))}
                      disabled={busyId === strip.id || blocked}
                      aria-pressed={inSpotlight}
                      title={blocked ? 'You already have one strip on Spotlight' : undefined}
                    >
                      {inSpotlight ? 'Remove' : 'Enter Spotlight'}
                    </button>
                    <button
                      type="button"
                      className="gallery-btn-delete"
                      onClick={() => setPendingDelete([strip.id])}
                      disabled={busyId === 'delete'}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
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
            <div className="spotlight-modal-preview">
              {draftStrip?.imageUrl ? (
                <div className="gallery-strip-frame">
                  <img src={draftStrip.imageUrl} alt={stripLabel(draftStrip)} />
                </div>
              ) : (
                <span>Preview</span>
              )}
            </div>
            <div className="spotlight-modal-fields">
              <h2 id="spotlight-modal-title">Enter Spotlight</h2>
              <p>
                This strip becomes your Photo of the Week entry. Only one strip can be entered at a time.
              </p>
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
                      value={draft[key]}
                      onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))}
                      placeholder={hint}
                      required
                    />
                  )}
                </label>
              ))}
              <label className="spotlight-social">
                Instagram or Facebook
                <span className="spotlight-social-row">
                  <select
                    value={draft.socialNetwork}
                    onChange={(event) => setDraft((prev) => ({ ...prev, socialNetwork: event.target.value }))}
                    required
                  >
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                  </select>
                  <input
                    type="text"
                    value={draft.social}
                    onChange={(event) => setDraft((prev) => ({ ...prev, social: event.target.value }))}
                    placeholder="@username or profile link"
                    required
                  />
                </span>
              </label>
              {formError && <p className="gallery-error">{formError}</p>}
              <div className="spotlight-modal-actions">
                <button type="button" onClick={() => setDraft(null)}>Cancel</button>
                <button type="submit" className="spotlight-modal-submit" disabled={busyId === draft.id}>
                  {busyId === draft.id ? 'Saving…' : 'Enter Spotlight'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
      {pendingSpotlightOff && (
        <ConfirmModal
          title="Remove from Spotlight?"
          message={`${stripLabel(pendingSpotlightOff)} will leave this week’s contest. You can enter another strip after.`}
          confirmLabel="Remove"
          onCancel={() => setPendingSpotlightOff(null)}
          onConfirm={() => removeSpotlight(pendingSpotlightOff)}
        />
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
