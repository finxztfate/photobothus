import { useEffect, useState } from 'react';
import { apiRequest } from '../utils/api';
import './Gallery.css';
import './AdminDashboard.css';

function AdminSpotlight() {
  const [strips, setStrips] = useState([]);
  const [picks, setPicks] = useState([]);
  const [captions, setCaptions] = useState({});
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [weekLockedUntil, setWeekLockedUntil] = useState(null);
  const [standings, setStandings] = useState([]);

  const load = async () => {
    const data = await apiRequest('/api/admin/spotlight');
    setStrips(data.strips || []);
    setPicks(data.picks || []);
    setWeekLockedUntil(data.weekLockedUntil || null);
    setStandings(data.standings || []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest('/api/admin/spotlight');
        if (cancelled) return;
        setStrips(data.strips || []);
        setPicks(data.picks || []);
        setWeekLockedUntil(data.weekLockedUntil || null);
        setStandings(data.standings || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const feature = async (strip, slot) => {
    setBusyId(`${slot}-${strip.id}`);
    setError('');
    try {
      await apiRequest('/api/admin/spotlight', {
        method: 'POST',
        body: { stripId: strip.id, slot, caption: captions[strip.id] || '' },
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const removePick = async (pick) => {
    setBusyId(`pick-${pick.id}`);
    setError('');
    try {
      await apiRequest(`/api/admin/spotlight/${pick.id}`, { method: 'DELETE' });
      setPicks((prev) => prev.filter((item) => item.id !== pick.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const week = picks.find((pick) => pick.slot === 'week');
  const home = picks.filter((pick) => pick.slot === 'home');
  const weekLocked = !!weekLockedUntil;
  const lockedLabel = weekLockedUntil
    ? new Date(weekLockedUntil).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="admin-page dash-page">
      <header className="admin-header dash-header">
        <div>
          <h1>Spotlight</h1>
          <p>Home carousel is a staff pick. Photo of the week needs 10 hearts; otherwise the slot stays empty until the next Sunday midnight.</p>
        </div>
      </header>
      {error && <p className="admin-error">{error}</p>}

      <section className="dash-panel">
        <div className="dash-panel-head">
          <h2>Current picks</h2>
        </div>
        <p className="dash-muted">
          Photo of the week: {week ? `${week.credit} — ${week.title || 'Untitled'}` : 'none'}
        </p>
        {weekLocked && (
          <p className="dash-muted">
            This photo stays until {lockedLabel}. It cannot be replaced or removed before then.
          </p>
        )}
        <p className="dash-muted">Home carousel: {home.length} of 3</p>
        <h3 className="dash-muted">This week’s standings</h3>
        <ul className="admin-spotlight-picks">
          {standings.map((row) => (
            <li key={row.stripId}>
              <span>{row.likes} ♥ · {row.credit} — {row.title || 'Untitled'}</span>
            </li>
          ))}
          {!standings.length && <li className="dash-muted">No votes yet this week.</li>}
        </ul>
        <ul className="admin-spotlight-picks">
          {picks.map((pick) => (
            <li key={pick.id}>
              <span>
                {pick.slot === 'week' ? 'Week' : 'Home'} · {pick.credit}
                {pick.caption ? ` — ${pick.caption}` : ''}
              </span>
              <button
                type="button"
                onClick={() => removePick(pick)}
                disabled={busyId === `pick-${pick.id}` || (pick.slot === 'week' && weekLocked)}
              >
                Remove
              </button>
            </li>
          ))}
          {!picks.length && <li className="dash-muted">No picks yet.</li>}
        </ul>
      </section>

      <div className="admin-grid admin-uploads-grid">
        {strips.map((strip) => (
          <article key={strip.id} className="admin-card admin-upload-card">
            <img className="admin-strip-thumb" src={strip.imageUrl} alt={strip.title || 'Strip'} />
            <div className="admin-card-body admin-spotlight-card">
              <div>
                <div>{strip.title || 'Untitled'}</div>
                <small>{strip.credit}</small>
              </div>
              <label>
                Caption
                <input
                  value={captions[strip.id] || ''}
                  onChange={(e) => setCaptions((prev) => ({ ...prev, [strip.id]: e.target.value }))}
                  placeholder="Short line shown with this photo"
                  maxLength={500}
                />
              </label>
              <button
                type="button"
                className="admin-action-btn"
                onClick={() => feature(strip, 'week')}
                disabled={weekLocked || busyId === `week-${strip.id}`}
              >
                Photo of the week
              </button>
              <button
                type="button"
                className="admin-action-btn"
                onClick={() => feature(strip, 'home')}
                disabled={busyId === `home-${strip.id}`}
              >
                Add to home
              </button>
            </div>
          </article>
        ))}
        {!strips.length && <p className="dash-muted">No customers have allowed a strip yet.</p>}
      </div>
    </div>
  );
}

export default AdminSpotlight;
