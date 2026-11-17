import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../../utils/api';
import { useAuth } from '../../../utils/auth';
import EventHostListCard from './components/EventHostListCard';
import './EventHostListPage.css';

function EventHostListPage() {
  const { isAuthenticated, isCustomer, loading, user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !isCustomer) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest('/api/events');
        if (!cancelled) setEvents(data.events || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, isCustomer]);

  const { activeEvents, historyEvents, totalStrips } = useMemo(() => {
    const active = [];
    const history = [];
    let strips = 0;
    events.forEach((event) => {
      strips += Number(event.stripCount || 0);
      if (event.isActive) active.push(event);
      else history.push(event);
    });
    return { activeEvents: active, historyEvents: history, totalStrips: strips };
  }, [events]);

  if (loading) return <div className="events-page"><p>Loading…</p></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isCustomer) return <Navigate to="/admin" replace />;

  return (
    <div className="events-page hub-dash-page">
      <div className="hub-shell">
        <header className="hub-hero">
          <div>
            <p className="hub-kicker">Event Dashboard</p>
            <h1>Your Events</h1>
            <p>Welcome{user?.displayName ? `, ${user.displayName}` : ''}. Manage live events and review completed history.</p>
          </div>
          <Link to="/events/new" className="hub-primary-btn">New Event</Link>
        </header>

        {error && <p className="events-error">{error}</p>}

        <section className="hub-stats">
          <div className="hub-stat">
            <strong>{activeEvents.length}</strong>
            <span>Active events</span>
          </div>
          <div className="hub-stat">
            <strong>{historyEvents.length}</strong>
            <span>Completed</span>
          </div>
          <div className="hub-stat">
            <strong>{events.length}</strong>
            <span>Total events</span>
          </div>
          <div className="hub-stat">
            <strong>{totalStrips}</strong>
            <span>Strips collected</span>
          </div>
        </section>

        {events.length === 0 ? (
          <div className="hub-empty">
            <h2>No events yet</h2>
            <p>Create your first event to get a QR code and start collecting guest photos.</p>
            <Link to="/events/new" className="hub-primary-btn">Create New Event</Link>
          </div>
        ) : (
          <div className="hub-panels">
            <section className="hub-panel">
              <div className="hub-panel-head">
                <h2>Active Events</h2>
                <span>{activeEvents.length}</span>
              </div>
              {activeEvents.length === 0 ? (
                <p className="hub-panel-empty">No live events. Create one to start collecting photos.</p>
              ) : (
                <div className="hub-event-list">
                  {activeEvents.map((event) => (
                    <EventHostListCard
                      key={event.id}
                      event={event}
                      onOpen={(eventId) => navigate(`/events/${eventId}`)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="hub-panel">
              <div className="hub-panel-head">
                <h2>History · Completed</h2>
                <span>{historyEvents.length}</span>
              </div>
              {historyEvents.length === 0 ? (
                <p className="hub-panel-empty">Ended events show here as completed history.</p>
              ) : (
                <div className="hub-event-list">
                  {historyEvents.map((event) => (
                    <EventHostListCard
                      key={event.id}
                      event={event}
                      history
                      onOpen={(eventId) => navigate(`/events/${eventId}`)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default EventHostListPage;