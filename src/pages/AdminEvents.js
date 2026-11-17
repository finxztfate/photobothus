import { useEffect, useState } from 'react';
import { apiRequest } from '../utils/api';
import './Gallery.css';
import './AdminDashboard.css';

function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest('/api/admin/events');
        if (!cancelled) setEvents(data.events || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (id) => {
    setBusyId(id);
    try {
      await apiRequest(`/api/admin/events/${id}`, { method: 'DELETE' });
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-page dash-page">
      <header className="admin-header dash-header">
        <div>
          <h1>Events</h1>
          <p>All hosted events across customer accounts.</p>
        </div>
      </header>
      {error && <p className="admin-error">{error}</p>}
      <section className="dash-panel dash-panel-table">
        <div className="dash-table-wrap">
          <table className="admin-table dash-table dash-table-responsive">
        <thead>
          <tr>
            <th>Name</th>
            <th>Code</th>
            <th>Owner</th>
            <th>Strips</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td data-label="Name">{event.name}</td>
              <td data-label="Code">{event.code}</td>
              <td data-label="Owner">{event.ownerEmail}</td>
              <td data-label="Strips">{event.stripCount}</td>
              <td data-label="Status">{event.isActive ? 'Active' : 'Closed'}</td>
              <td data-label="Actions">
                <button
                  type="button"
                  className="admin-action-btn"
                  onClick={() => handleDelete(event.id)}
                  disabled={busyId === event.id}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default AdminEvents;
