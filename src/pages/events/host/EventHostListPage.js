import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../../utils/api';
import { useAuth } from '../../../utils/auth';
import EventHostListCard from './components/EventHostListCard';
import { EventHostDashLayout } from './components/EventHostSidebar';
import './EventHostListPage.css';

function EventHostListPage() {
  const { isAuthenticated, isCustomer, loading } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [canCreate, setCanCreate] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !isCustomer) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest('/api/events');
        if (!cancelled) {
          setEvents(data.events || []);
          setCanCreate(data.canCreate !== false);
        }
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

  if (loading) {
    return (
      <EventHostDashLayout>
        <div className="events-page"><p>Loading…</p></div>
      </EventHostDashLayout>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isCustomer) return <Navigate to="/admin" replace />;

  return (
    <EventHostDashLayout>
    <div className="events-page hub-dash-page">
      <div className="hub-shell">
        <header className="hub-hero">
          <div>
            <p className="hub-kicker">Event Dashboard</p>
            <h1>Your events</h1>
          </div>
        </header>

        {error && <p className="events-error">{error}</p>}

        <section className="hub-stats" aria-label="Event summary">
          <div className="hub-stat">
            <strong>{activeEvents.length}</strong>
            <span>Live</span>
          </div>
          <div className="hub-stat">
            <strong>{historyEvents.length}</strong>
            <span>Completed</span>
          </div>
          <div className="hub-stat">
            <strong>{totalStrips}</strong>
            <span>Photos</span>
          </div>
          <div className="hub-stat">
            <strong>{events.length}</strong>
            <span>Total</span>
          </div>
        </section>

        {events.length === 0 ? (
          <div className="hub-empty">
            <h2>No events yet</h2>
            <p>
              {canCreate
                ? 'Create your first event to get a QR code and start collecting guest photos.'
                : 'Event creation is currently off.'}
            </p>
            {canCreate ? <Link to="/events/new" className="hub-primary-btn">Create New Event</Link> : null}
          </div>
        ) : (
          <div className="hub-sections">
            {activeEvents.length > 0 ? (
              <section>
                <div className="hub-section-head">
                  <h2>Live</h2>
                  <span>{activeEvents.length}</span>
                </div>
                <div className="hub-event-list">
                  {activeEvents.map((event) => (
                    <EventHostListCard
                      key={event.id}
                      event={event}
                      onOpen={(eventId) => navigate(`/events/${eventId}`)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <div className="hub-section-head">
                <h2>Completed</h2>
                <span>{historyEvents.length}</span>
              </div>
              {historyEvents.length === 0 ? (
                <p className="hub-panel-empty">Ended events land here with their guest photos unlocked.</p>
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
    </EventHostDashLayout>
  );
}

export default EventHostListPage;