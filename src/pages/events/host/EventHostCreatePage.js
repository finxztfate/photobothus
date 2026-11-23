import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../../utils/api';
import { useAuth } from '../../../utils/auth';
import { buildSchedule } from '../../../utils/eventSchedule';
import EventScheduleFields from './components/EventScheduleFields';
import { DEFAULT_MAX_GUEST_UPLOADS } from '../../../data/eventLimits';
import { EventHostDashLayout } from './components/EventHostSidebar';
import '../../AuthPages.css';

function EventHostCreatePage() {
  const { isAuthenticated, isCustomer, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    hostName: '',
    eventDate: '',
    startTime: '',
    endTime: '',
    location: '',
    welcomeMessage: '',
    hashtags: '',
    stripsEnabled: true,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [quota, setQuota] = useState(null);
  const [buying, setBuying] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !isCustomer) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest('/api/events');
        if (!cancelled) {
          setQuota({
            events: data.events || [],
            canCreate: data.canCreate !== false,
            tickets: Number(data.tickets || 0),
            potwWinsUntilTicket: Number(data.potwWinsUntilTicket || 3),
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load events');
          setQuota({ events: [], canCreate: true, tickets: 0, potwWinsUntilTicket: 3 });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, isCustomer]);

  if (loading) return <div className="auth-page"><p>Loading…</p></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isCustomer) return <Navigate to="/admin" replace />;

  if (quota === null) {
    return (
      <EventHostDashLayout>
        <div className="auth-page"><p>Loading…</p></div>
      </EventHostDashLayout>
    );
  }

  if (!quota.canCreate) {
    return (
      <EventHostDashLayout>
        <div className="auth-page">
          <div className="auth-card auth-card-wide event-details-card">
            <p className="auth-kicker">Event dashboard</p>
            <h1>Event creation is off</h1>
            <p className="auth-subtitle">
              New events cannot be created right now. Existing events still work.
            </p>
            <Link to="/events" className="hub-primary-btn">Back to events</Link>
          </div>
        </div>
      </EventHostDashLayout>
    );
  }

  const update = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const schedule = buildSchedule(form.eventDate, form.startTime, form.endTime);

  const requestPack = async (pack) => {
    setError('');
    setBuying(pack);
    try {
      const data = await apiRequest('/api/tickets/purchase', { method: 'POST', body: { pack } });
      setError(data.message || `Requested a ${pack}-ticket pack. Tickets are added when payment is marked paid.`);
    } catch (err) {
      setError(err.message || 'Could not request tickets');
    } finally {
      setBuying(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!quota.tickets) {
      setError('An event ticket is required. Buy a pack or win Photo of the Week 3 times.');
      return;
    }
    if (schedule.error) {
      setError(schedule.error);
      return;
    }
    setSubmitting(true);
    try {
      const data = await apiRequest('/api/events', {
        method: 'POST',
        body: {
          name: form.name,
          hostName: form.hostName,
          eventDate: form.eventDate || null,
          startsAt: schedule.startsAt,
          endsAt: schedule.endsAt,
          location: form.location,
          welcomeMessage: form.welcomeMessage,
          hashtags: form.hashtags,
          stripsEnabled: form.stripsEnabled,
        },
      });
      navigate(`/events/${data.event.id}`);
    } catch (err) {
      setError(err.message || 'Could not create event');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <EventHostDashLayout>
    <div className="auth-page">
      <form className="auth-card auth-card-wide event-details-card" onSubmit={handleSubmit}>
        <p className="auth-kicker">Event dashboard</p>
        <h1>New event</h1>
        <p className="auth-subtitle">Details guests see on the QR landing page and booth.</p>
        <p className="auth-hint">
          This uses 1 event ticket ({quota.tickets} left). Buy a 1, 5, or 10 pack, or earn a ticket by
          becoming Photo of the Week 3 times ({quota.potwWinsUntilTicket} win{quota.potwWinsUntilTicket === 1 ? '' : 's'} to go).
          Each guest can upload {DEFAULT_MAX_GUEST_UPLOADS} photos. Guest photos stay hidden until the event ends.
        </p>
        <div className="event-ticket-packs">
          {[1, 5, 10].map((pack) => (
            <button
              key={pack}
              type="button"
              onClick={() => requestPack(pack)}
              disabled={buying != null}
            >
              {buying === pack ? 'Requesting…' : `Request ${pack} ticket${pack === 1 ? '' : 's'}`}
            </button>
          ))}
        </div>
        {error && <p className="auth-error">{error}</p>}

        <label>
          Event title
          <input
            value={form.name}
            onChange={update('name')}
            required
            placeholder="Birthday party"
          />
        </label>

        <label>
          Host / Organizer
          <input
            value={form.hostName}
            onChange={update('hostName')}
            required
            placeholder="Host or organizer"
          />
        </label>

        <EventScheduleFields form={form} update={update} />

        <label>
          Location / Venue
          <input
            value={form.location}
            onChange={update('location')}
            required
            placeholder="Venue or city"
          />
        </label>

        <label className="event-details-span">
          Welcome message for guests
          <textarea
            value={form.welcomeMessage}
            onChange={update('welcomeMessage')}
            rows={3}
            required
            placeholder="Welcome! Strike a pose and share your favorite moments with us."
          ></textarea>
        </label>

        <label>
          Hashtags <span className="auth-optional">(optional)</span>
          <input
            value={form.hashtags}
            onChange={update('hashtags')}
            placeholder="#EventNight #Photobothus"
          />
        </label>

        <label className="auth-checkbox">
          <input
            type="checkbox"
            checked={form.stripsEnabled}
            onChange={(e) => setForm((prev) => ({ ...prev, stripsEnabled: e.target.checked }))}
          />
          <span>Enable photo strips</span>
        </label>

        <button type="submit" disabled={submitting || !!schedule.error || !quota.tickets}>
          {submitting ? 'Creating…' : quota.tickets ? 'Create event' : 'Need a ticket'}
        </button>
      </form>
    </div>
    </EventHostDashLayout>
  );
}

export default EventHostCreatePage;