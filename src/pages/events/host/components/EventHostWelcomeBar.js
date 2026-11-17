import { formatEventDateTime } from '../../../../utils/eventSchedule';

function EventHostWelcomeBar({ event, copied, busy, onCopyLink, onToggleActive }) {
  const closesAt = event.isActive && event.endsAt ? formatEventDateTime(event.endsAt) : '';

  return (
    <section className="event-host-welcome">
      <div>
        <h1>{event.name}</h1>
        <p>Dashboard{closesAt ? ` · Closes automatically ${closesAt}` : ''}</p>
      </div>
      <div className="event-host-welcome-actions">
        <span className={`event-host-status ${event.isActive ? 'is-active' : 'is-closed'}`}>
          {event.isActive ? 'Live' : 'Completed'}
        </span>
        {event.isActive && (
          <button type="button" className="event-host-btn" onClick={onCopyLink}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
        )}
        {event.isActive && (
          <button
            type="button"
            className="event-host-btn"
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
