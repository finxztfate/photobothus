import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
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
    stripsEnabled: false,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="auth-page"><p>Loading…</p></div>;
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

        <button type="submit" disabled={submitting || !!schedule.error}>
          {submitting ? 'Creating…' : 'Create event'}
        </button>
      </form>
    </div>
    </EventHostDashLayout>
  );
}

export default EventHostCreatePage;