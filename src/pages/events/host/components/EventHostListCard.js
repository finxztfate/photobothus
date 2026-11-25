import { formatShortEventDate } from '../utils/formatEventDate';
import { formatEventTimeRange } from '../../../../utils/eventSchedule';

function EventHostListCard({ event, onOpen, history = false }) {
  const photos = Number(event.stripCount || 0);
  const when = [
    event.eventDate ? formatShortEventDate(event.eventDate) : null,
    formatEventTimeRange(event) || null,
  ].filter(Boolean).join(' · ');
  const facts = [
    when ? { label: 'Date & time', value: when } : null,
    event.location ? { label: 'Place', value: event.location } : null,
    event.hostName ? { label: 'Host', value: event.hostName } : null,
    !history && event.code ? { label: 'Code', value: event.code } : null,
    history && event.completedAt
      ? { label: 'Ended', value: formatShortEventDate(event.completedAt) }
      : null,
  ].filter(Boolean);

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
        {facts.length > 0 ? (
          <dl className="event-host-event-facts">
            {facts.map((fact) => (
              <div
                key={fact.label}
                className={`event-host-event-fact${fact.label === 'Code' ? ' is-code' : ''}`}
              >
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
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
