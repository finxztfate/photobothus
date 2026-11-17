import { formatLongEventDate } from '../utils/formatEventDate';

function EventHostStatsGrid({ event, stripCount, guestCount }) {
  return (
    <section className="event-host-stats">
      <article className="event-host-stat">
        <h2>Uploaded Photos</h2>
        <p className="event-host-stat-value">{stripCount}</p>
      </article>
      <article className="event-host-stat">
        <h2>Guests</h2>
        <p className="event-host-stat-value">{guestCount}</p>
      </article>
      <article className="event-host-stat">
        <h2>Event date</h2>
        <p className="event-host-stat-value event-host-stat-text">
          {formatLongEventDate(event.eventDate)}
        </p>
      </article>
      <article className="event-host-stat">
        <h2>Mode</h2>
        <p className="event-host-stat-value event-host-stat-text">
          {event.stripsEnabled ? 'Strips on' : 'Photos only'}
        </p>
      </article>
    </section>
  );
}

export default EventHostStatsGrid;
