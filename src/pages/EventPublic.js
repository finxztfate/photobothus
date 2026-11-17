import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiRequest, getEventGuestKey } from '../utils/api';
import { formatEventTimeRange, parseEventDate } from '../utils/eventSchedule';
import './Gallery.css';
import './EventEditor.css';

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
  const maxGuestUploads = 10;

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
    if (event?.stripsEnabled) {
      navigate(`/e/${code}/layouts`);
    } else {
      navigate(`/e/${code}/photobooth?layout=3`);
    }
  };

  const goHome = () => {
    try {
      sessionStorage.removeItem('eventEditorState');
      sessionStorage.removeItem('eventCode');
    } catch {
      /* ignore */
    }
    navigate('/');
  };

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

      <div className="events-empty event-public-card">
        {loading ? (
          <p>Loading event…</p>
        ) : error ? (
          <>
            <h1>Event unavailable</h1>
            <p>{error}</p>
            <Link to="/">Back home</Link>
          </>
        ) : (
          <>
            <h1>{event.name}</h1>
            {event.hostName && <p><strong>Host:</strong> {event.hostName}</p>}
            {event.eventDate && <p><strong>Date:</strong> {formatEventDate(event.eventDate)}</p>}
            {formatEventTimeRange(event) && (
              <p><strong>Time:</strong> {formatEventTimeRange(event)}</p>
            )}
            {event.location && <p><strong>Venue:</strong> {event.location}</p>}
            <p>
              {event.welcomeMessage ||
                'You’re joining this Photobothus event. Take photos and they’ll be saved to the event gallery.'}
            </p>
            {event.hashtags && <p className="event-hashtags">{event.hashtags}</p>}
            {event.eventFull && (
              <p className="events-error" role="status">
                This event’s gallery is full, so new photos can’t be added right now. Ask the
                host to make room.
              </p>
            )}
            {event.isActive === false ? (
              <p className="events-error" role="status">
                This event is closed. The guest link is no longer available.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  className="event-public-start"
                  onClick={startBooth}
                  disabled={!!event.eventFull}
                >
                  Start Photobooth
                </button>
                <p className="event-public-hint">
                  {event.stripsEnabled
                    ? 'Works best on your phone. Pick a layout → capture → edit → Upload.'
                    : 'Works best on your phone. Capture → edit → Upload to this event.'}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default EventPublic;
