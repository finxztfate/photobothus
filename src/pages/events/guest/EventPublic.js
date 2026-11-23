import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiRequest, getEventGuestKey } from '../../../utils/api';
import { formatEventTimeRange, parseEventDate } from '../../../utils/eventSchedule';
import { DEFAULT_MAX_GUEST_UPLOADS } from '../../../data/eventLimits';
import { clearEditorSession } from '../../../utils/eventSession';
import './EventPublic.css';
import '../host/EventEditor.css';

function formatEventDate(value) {
  const date = parseEventDate(value);
  if (!date) return null;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function EventPublic() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [limitReached, setLimitReached] = useState(false);
  const [guestUploadCount, setGuestUploadCount] = useState(0);
  const maxGuestUploads = Number(event?.maxGuestUploads) || DEFAULT_MAX_GUEST_UPLOADS;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const guestKey = getEventGuestKey(code);
        const data = await apiRequest(
          `/api/public/events/${code}?guestKey=${encodeURIComponent(guestKey)}`
        );
        if (cancelled) return;
        setEvent(data.event);
        setGuestUploadCount(data.event.guestUploadCount || 0);
        if (Number(data.event.uploadsRemaining) <= 0) {
          setLimitReached(true);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Event not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  const startBooth = () => {
    if (limitReached) {
      setLimitReached(true);
      return;
    }
    sessionStorage.setItem('eventCode', code);
    navigate(`/e/${code}/layouts`);
  };

  const goHome = () => {
    clearEditorSession();
    navigate('/');
  };

  const live = event && event.isActive !== false;
  const when = event ? formatEventDate(event.eventDate) : null;
  const time = event ? formatEventTimeRange(event) : null;

  return (
    <div className="event-public-page">
      {limitReached &&
        createPortal(
          <div className="edit-download-modal" role="dialog" aria-modal="true">
            <div className="edit-download-modal-card">
              <h2>Upload limit reached</h2>
              <p>
                You’ve used all <strong>{maxGuestUploads}</strong> uploads for this event
                ({guestUploadCount}/{maxGuestUploads}).
              </p>
              <p>Thanks for sharing your moments!</p>
              <div className="custom-modal-actions">
                <button type="button" className="edit-download" onClick={goHome}>
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {loading ? (
        <div className="event-public-loading">
          <div className="event-public-spinner" />
          <p>Loading event…</p>
        </div>
      ) : error ? (
        <div className="event-public-main">
          <p className="event-public-kicker">Guest booth</p>
          <h1>Event unavailable</h1>
          <p className="event-public-lead">{error}</p>
          <Link className="event-public-home" to="/">Back home</Link>
        </div>
      ) : (
        <div className="event-public-main page-fade">
          <p className={`event-public-kicker${live ? ' is-live' : ''}`}>
            {live ? 'Guest booth' : 'Event closed'}
          </p>
          <h1>{event.name}</h1>
          <p className="event-public-lead">
            {event.welcomeMessage ||
              'You’re joining this Photobothus event. Take photos and they’ll be saved to the event gallery.'}
          </p>
          {event.hashtags ? <p className="event-public-tags">{event.hashtags}</p> : null}

          <section className="event-public-meta" aria-label="Event details">
            {event.hostName ? (
              <article>
                <h2>Host</h2>
                <p>{event.hostName}</p>
              </article>
            ) : null}
            {when || time ? (
              <article className="event-public-when">
                <h2>{when && time ? 'When' : when ? 'Date' : 'Time'}</h2>
                {when ? <p>{when}</p> : null}
                {time ? <p className="event-public-time">{time}</p> : null}
              </article>
            ) : null}
            {event.location ? (
              <article>
                <h2>Venue</h2>
                <p>{event.location}</p>
              </article>
            ) : null}
          </section>

          {event.eventFull && (
            <p className="event-public-alert" role="status">
              This event’s gallery is full, so new photos can’t be added right now. Ask the
              host to make room.
            </p>
          )}

          {!live ? (
            <p className="event-public-alert" role="status">
              This event is closed. The guest link is no longer available.
            </p>
          ) : (
            <div className="event-public-cta">
              <button
                type="button"
                className="event-public-start"
                onClick={startBooth}
                disabled={!!event.eventFull}
              >
                Choose a layout
              </button>
              <p className="event-public-hint">
                Works best on your phone. Tap a strip layout to open the booth, then send to the event.
                {' '}Each guest can upload {maxGuestUploads} photos.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default EventPublic;
