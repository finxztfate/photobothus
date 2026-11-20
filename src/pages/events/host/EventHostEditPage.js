import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../../../utils/api';
import { useAuth } from '../../../utils/auth';
import { buildSchedule, toTimeInputValue } from '../../../utils/eventSchedule';
import EventScheduleFields from './components/EventScheduleFields';
import { DEFAULT_MAX_GUEST_UPLOADS } from '../../../data/eventLimits';
import { EventHostDashLayout } from './components/EventHostSidebar';
import '../../AuthPages.css';

// The API sends the event date as a plain calendar day ("2026-11-20").
function toDateInputValue(value) {
  return value ? String(value).slice(0, 10) : '';
}

/** Route: /events/:id/edit — edit event settings */
function EventHostEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isCustomer, loading } = useAuth();
  const [form, setForm] = useState({
    name: '',
    hostName: '',
    eventDate: '',
    startTime: '',
    endTime: '',
    location: '',
    welcomeMessage: '',
    hashtags: '',
    stripsEnabled: false,
  });
  const [error, setError] = useState('');
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !isCustomer) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest(`/api/events/${id}`);
        if (cancelled) return;
        const event = data.event;
        setForm({
          name: event.name || '',
          hostName: event.hostName || '',
          eventDate: toDateInputValue(event.eventDate),
          startTime: toTimeInputValue(event.startsAt),
          endTime: toTimeInputValue(event.endsAt),
          location: event.location || '',
          welcomeMessage: event.welcomeMessage || '',
          hashtags: event.hashtags || '',
          stripsEnabled: !!event.stripsEnabled,
        });
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load event');
      } finally {
        if (!cancelled) setLoadingEvent(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated, isCustomer]);

  if (loading || loadingEvent) {
    return <div className="auth-page"><p>Loading…</p></div>;
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isCustomer) return <Navigate to="/admin" replace />;

  const update = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const schedule = buildSchedule(form.eventDate, form.startTime, form.endTime);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (schedule.error) {
      setError(schedule.error);
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest(`/api/events/${id}`, {
        method: 'PATCH',
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
      navigate(`/events/${id}`);
    } catch (err) {
      setError(err.message || 'Could not update event');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete "${form.name || 'this event'}"? The event, its guest link, and every photo uploaded to it will be permanently deleted.`
    );
    if (!confirmed) return;
    setError('');
    setDeleting(true);
    try {
      await apiRequest(`/api/events/${id}`, { method: 'DELETE' });
      navigate('/events');
    } catch (err) {
      setError(err.message || 'Could not delete event');
      setDeleting(false);
    }
  };

  return (
    <EventHostDashLayout>
    <div className="auth-page">
      <form className="auth-card auth-card-wide event-details-card" onSubmit={handleSubmit}>
        <p className="auth-kicker">Event dashboard</p>
        <h1>Edit event</h1>
        <p className="auth-subtitle">Update what guests see on the landing page and booth.</p>
        <p className="auth-hint">
          Each guest can upload {DEFAULT_MAX_GUEST_UPLOADS} photos to this event. Extra uploads are blocked.
          Guest photos stay hidden until the event ends.
        </p>
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

        <button type="submit" disabled={submitting || deleting || !!schedule.error}>
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
        <p className="auth-footer">
          <Link to={`/events/${id}`}>Cancel · back to dashboard</Link>
        </p>

        <div className="auth-danger-zone">
          <p>Deleting removes the event and all of its guest photos for good.</p>
          <button
            type="button"
            className="auth-danger-btn"
            onClick={handleDelete}
            disabled={submitting || deleting}
          >
            {deleting ? 'Deleting…' : 'Delete event'}
          </button>
        </div>
      </form>
    </div>
    </EventHostDashLayout>
  );
}

export default EventHostEditPage;
