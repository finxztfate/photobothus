import { formatShortEventDate } from '../utils/formatEventDate';
import { formatEventTimeRange } from '../../../../utils/eventSchedule';

function EventHostListCard({ event, onOpen, history = false }) {
  const photos = Number(event.stripCount || 0);
  const when = [
    event.eventDate ? formatShortEventDate(event.eventDate) : null,
    formatEventTimeRange(event),
  ].filter(Boolean).join(' · ');
  const where = [event.hostName, event.location].filter(Boolean).join(' · ');

  return (
    <button
      type="button"
      className={`event-host-event-card ${history ? 'is-history' : ''}`}
      onClick={() => onOpen(event.id)}
    >
      <div className="event-host-event-card-main">
        <div className="event-host-event-card-top">
          <h3>{event.name}</h3>
          <span className={`event-host-badge ${history ? 'is-complete' : 'is-live'}`}>
            {history ? 'Completed' : 'Live'}
          </span>
        </div>
        {when ? <p className="event-host-event-meta">{when}</p> : null}
        {where ? <p className="event-host-event-meta">{where}</p> : null}
        {!history && event.code ? (
          <p className="event-host-event-code">Code {event.code}</p>
        ) : null}
        {history && event.completedAt ? (
          <p className="event-host-event-meta">
            Ended {formatShortEventDate(event.completedAt)}
          </p>
        ) : null}
      </div>
      <p className="event-host-event-count">
        <strong>{photos}</strong>
        <span>{photos === 1 ? 'photo' : 'photos'}</span>
      </p>
    </button>
  );
}

export default EventHostListCard;
