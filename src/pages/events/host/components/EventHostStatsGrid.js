import { formatLongEventDate } from '../utils/formatEventDate';

function EventHostStatsGrid({ event, stripCount, guestCount }) {
  return (
    <section className="event-host-stats">
      <article className="event-host-stat">
        <p className="event-host-stat-value">{stripCount}</p>
        <h2>Photos</h2>
      </article>
      <article className="event-host-stat">
        <p className="event-host-stat-value">{guestCount}</p>
        <h2>Guests</h2>
      </article>
      <article className="event-host-stat">
        <p className="event-host-stat-value event-host-stat-text">
          {formatLongEventDate(event.eventDate)}
        </p>
        <h2>Date</h2>
      </article>
      <article className="event-host-stat">
        <p className="event-host-stat-value event-host-stat-text">
          {event.stripsEnabled ? 'Strips on' : 'Photos only'}
        </p>
        <h2>Mode</h2>
      </article>
    </section>
  );
}

export default EventHostStatsGrid;
