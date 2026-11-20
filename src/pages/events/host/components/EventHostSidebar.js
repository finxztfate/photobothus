import { Link, useLocation } from 'react-router-dom';
import './EventHostSidebar.css';

function EventHostSidebar() {
  const { pathname } = useLocation();
  const onNew = pathname.startsWith('/events/new');
  const onEvents = pathname.startsWith('/events') && !onNew;

  return (
    <nav className="event-dash-sidebar" aria-label="Event dashboard">
      <p className="event-dash-sidebar-kicker">Dashboard</p>
      <Link to="/events" className={`event-dash-tab ${onEvents ? 'is-active' : ''}`}>
        Events
      </Link>
      <Link to="/events/new" className={`event-dash-tab ${onNew ? 'is-active' : ''}`}>
        New Event
      </Link>
    </nav>
  );
}

export function EventHostDashLayout({ children }) {
  return (
    <div className="event-dash">
      <EventHostSidebar />
      <div className="event-dash-content">{children}</div>
    </div>
  );
}

export default EventHostSidebar;
