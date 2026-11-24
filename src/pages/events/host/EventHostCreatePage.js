import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../../utils/api';
import { useAuth } from '../../../utils/auth';
import { buildSchedule } from '../../../utils/eventSchedule';
import { DEFAULT_MAX_EVENT_UPLOADS } from '../../../data/eventLimits';
import { allLayoutIds, serializeAllowedLayoutsForApi } from '../../../utils/eventLayoutCapacity';
import EventScheduleFields from './components/EventScheduleFields';
import EventAllowedLayoutsField from './components/EventAllowedLayoutsField';
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
    allowedLayouts: allLayoutIds(),
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [quota, setQuota] = useState(null);
  const [adminMaxEventUploads, setAdminMaxEventUploads] = useState(DEFAULT_MAX_EVENT_UPLOADS);

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
          });
          if (Number(data.maxEventUploads) > 0) {
            setAdminMaxEventUploads(Number(data.maxEventUploads));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load events');
          setQuota({ events: [], canCreate: true, tickets: 0 });
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!quota.tickets) {
      setError('You need an event ticket first.');
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
          stripsEnabled: true,
          allowedLayouts: serializeAllowedLayoutsForApi(form.allowedLayouts),
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
        {!quota.tickets ? (
          <p className="auth-hint">
            You need a ticket to create an event. <Link to="/tickets">Buy tickets</Link>
          </p>
        ) : null}
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

        <EventAllowedLayoutsField
          selectedIds={form.allowedLayouts}
          adminMaxEventUploads={adminMaxEventUploads}
          onChange={(allowedLayouts) => setForm((prev) => ({ ...prev, allowedLayouts }))}
        />

        <button type="submit" disabled={submitting || !!schedule.error || !quota.tickets}>
          {submitting ? 'Creating…' : quota.tickets ? 'Create event' : 'Need a ticket'}
        </button>
      </form>
    </div>
    </EventHostDashLayout>
  );
}

export default EventHostCreatePage;