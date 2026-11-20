import { Link } from 'react-router-dom';
import { formatEventDateTime } from '../../../../utils/eventSchedule';

function EventHostWelcomeBar({ event, copied, busy, onCopyLink, onToggleActive, onToggleStrips }) {
  const closesAt = event.isActive && event.endsAt ? formatEventDateTime(event.endsAt) : '';

  return (
    <section className="event-host-welcome">
      <div>
        <p className={`event-host-kicker ${event.isActive ? 'is-live' : ''}`}>
          {event.isActive ? 'Live event' : 'Completed event'}
        </p>
        <h1>{event.name}</h1>
        <p>
          {event.isActive
            ? `Guest photos stay hidden until the event ends${closesAt ? ` · Closes ${closesAt}` : ''}`
            : 'Guest photos are unlocked. Review, remove, and download the set.'}
        </p>
        <label className="event-host-checkbox">
          <input
            type="checkbox"
            checked={!!event.stripsEnabled}
            onChange={onToggleStrips}
            disabled={busy}
          />
          Enable photo strips
        </label>
      </div>
      <div className="event-host-welcome-actions">
        <Link to={`/events/${event.id}/edit`} className="event-host-btn">
          Edit
        </Link>
        {event.isActive && (
          <button type="button" className="event-host-btn" onClick={onCopyLink}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
        )}
        {event.isActive && (
          <button
            type="button"
            className="event-host-btn primary"
            onClick={onToggleActive}
            disabled={busy}
          >
            End event
          </button>
        )}
      </div>
    </section>
  );
}

export default EventHostWelcomeBar;
