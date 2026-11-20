import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiRequest } from '../../../../utils/api';
import { useAuth } from '../../../../utils/auth';
import './EventHostSidebar.css';

function EventHostSidebar() {
  const { pathname } = useLocation();
  const { isAuthenticated, isCustomer } = useAuth();
  const [canCreate, setCanCreate] = useState(true);
  const onNew = pathname.startsWith('/events/new');
  const onEvents = pathname.startsWith('/events') && !onNew;

  useEffect(() => {
    if (!isAuthenticated || !isCustomer) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest('/api/events', { silent: true });
        if (!cancelled) setCanCreate(data.canCreate !== false);
      } catch {
        if (!cancelled) setCanCreate(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, isCustomer, pathname]);

  return (
    <nav className="event-dash-sidebar" aria-label="Event dashboard">
      <p className="event-dash-sidebar-kicker">Dashboard</p>
      <Link to="/events" className={`event-dash-tab ${onEvents ? 'is-active' : ''}`}>
        Events
      </Link>
      {canCreate ? (
        <Link to="/events/new" className={`event-dash-tab ${onNew ? 'is-active' : ''}`}>
          New Event
        </Link>
      ) : null}
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
