import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../utils/api';
import './Gallery.css';
import './AdminDashboard.css';

function formatWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function AdminFeedback() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const load = async () => {
    const data = await apiRequest('/api/admin/feedback');
    setItems(data.feedback || []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load feedback');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(
    () => items.filter((item) => statusFilter === 'all' || item.status === statusFilter),
    [items, statusFilter]
  );

  const newCount = items.filter((item) => item.status === 'new').length;

  async function setStatus(id, status) {
    setBusyId(id);
    setError('');
    try {
      await apiRequest(`/api/admin/feedback/${id}/status`, {
        method: 'POST',
        body: { status },
      });
      setItems((current) => current.map((item) => (
        item.id === id ? { ...item, status } : item
      )));
    } catch (err) {
      setError(err.message || 'Failed to update feedback');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Feedback</h1>
          <p>
            {newCount
              ? `${newCount} new message${newCount === 1 ? '' : 's'} from Any Feedback`
              : 'Messages from the public feedback form'}
          </p>
        </div>
        <div className="admin-filters">
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="new">New</option>
              <option value="read">Read</option>
              <option value="done">Done</option>
            </select>
          </label>
        </div>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      {filtered.length === 0 ? (
        <p className="admin-error" style={{ color: 'var(--text-muted)' }}>No feedback yet.</p>
      ) : (
        <div className="admin-feedback-list">
          {filtered.map((item) => (
            <article
              key={item.id}
              className={`admin-feedback-card${item.status === 'new' ? ' is-new' : ''}`}
            >
              <div className="admin-feedback-top">
                <div>
                  <h2>{item.name}</h2>
                  <p className="admin-feedback-meta">
                    <a href={`mailto:${item.email}`}>{item.email}</a>
                    <span>·</span>
                    <span>{formatWhen(item.createdAt)}</span>
                    {item.userDisplayName ? (
                      <>
                        <span>·</span>
                        <span>Account {item.userDisplayName}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <span className={`admin-feedback-status is-${item.status}`}>{item.status}</span>
              </div>
              <p className="admin-feedback-message">{item.message}</p>
              <div className="admin-feedback-actions">
                {item.status !== 'read' ? (
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => setStatus(item.id, 'read')}
                  >
                    Mark read
                  </button>
                ) : null}
                {item.status !== 'done' ? (
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => setStatus(item.id, 'done')}
                  >
                    Mark done
                  </button>
                ) : null}
                {item.status !== 'new' ? (
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => setStatus(item.id, 'new')}
                  >
                    Mark new
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminFeedback;
