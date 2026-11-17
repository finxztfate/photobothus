import { formatShortEventDate } from '../utils/formatEventDate';
import { formatEventTimeRange } from '../../../../utils/eventSchedule';

function EventHostListCard({ event, onOpen, history = false }) {
  return (
    <article className={`event-host-event-card ${history ? 'is-history' : ''}`}>
      <div className="event-host-event-card-top">
        <h3>{event.name}</h3>
        <span className={`event-host-badge ${history ? 'is-complete' : 'is-live'}`}>
          {history ? 'Completed' : 'Active'}
        </span>
      </div>
      <div className="event-host-event-meta">
        {event.hostName && <span>Host: {event.hostName}</span>}
        {event.eventDate && <span>{formatShortEventDate(event.eventDate)}</span>}
        {formatEventTimeRange(event) && <span>{formatEventTimeRange(event)}</span>}
        {event.location && <span>{event.location}</span>}
        {!history && <span>Code: {event.code}</span>}
        <span>{event.stripCount || 0} strips</span>
        {history && event.completedAt && (
          <span>Ended: {formatShortEventDate(event.completedAt)}</span>
        )}
      </div>
      <button type="button" className="event-host-event-btn" onClick={() => onOpen(event.id)}>
        {history ? 'View completed event' : 'Manage event'}
      </button>
    </article>
  );
}

export default EventHostListCard;