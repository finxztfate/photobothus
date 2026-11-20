import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import './EventGuestShell.css';

function EventGuestShell() {
  const { code } = useParams();
  const location = useLocation();
  const [event, setEvent] = useState(null);
  const [unavailable, setUnavailable] = useState('');
  const [checked, setChecked] = useState(false);
  const onEditor = location.pathname.includes('/editor');
  const onBooth = location.pathname.includes('/photobooth');
  const hideNav = onEditor || onBooth;

  useEffect(() => {
    if (!code) return undefined;
    setChecked(false);
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest(`/api/public/events/${code}`);
        if (!cancelled) {
          setEvent(data.event);
          setUnavailable('');
          if (data.event?.isActive) sessionStorage.setItem('eventCode', code);
          else sessionStorage.removeItem('eventCode');
        }
      } catch (err) {
        if (!cancelled) {
          setEvent(null);
          setUnavailable(err.message || 'Event not found');
        }
      }
    })().finally(() => {
      if (!cancelled) setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const stripsEnabled = !!event?.stripsEnabled && event?.isActive !== false;
  const closed = !!event && event.isActive === false;
  const infoPath = `/e/${code}`;

  if (!checked) {
    return (
      <div className="event-guest-shell">
        <div className="event-guest-closed page-fade">
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  if (closed && location.pathname !== infoPath) {
    return <Navigate to={infoPath} replace />;
  }

  if (unavailable) {
    return (
      <div className="event-guest-shell">
        <div className="event-guest-closed page-fade">
          <h1>{/closed/i.test(unavailable) ? 'This event is closed' : 'Event unavailable'}</h1>
          <p>
            {/closed/i.test(unavailable)
              ? 'The guest link is no longer available.'
              : unavailable}
          </p>
          <Link to="/">Back home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`event-guest-shell${hideNav ? ' is-compact' : ''}`}>
      {!hideNav && (
      <header className="event-guest-nav">
        <div className="event-guest-nav-brand">
          <Link to={`/e/${code}`} className="event-guest-nav-title">
            {event?.name || 'Event photobooth'}
          </Link>
          <span className="event-guest-nav-sub">Guest session</span>
        </div>
        <nav className="event-guest-nav-links" aria-label="Event guest navigation">
          <NavLink to={`/e/${code}`} end>
            Event
          </NavLink>
          {!closed && stripsEnabled && (
            <NavLink to={`/e/${code}/layouts`}>Layouts</NavLink>
          )}
          {!closed && (
            <NavLink to={`/e/${code}/photobooth`}>Booth</NavLink>
          )}
          {onEditor && (
            <NavLink to={`/e/${code}/editor`}>Editor</NavLink>
          )}
        </nav>
      </header>
      )}
      <div key={location.pathname} className="event-guest-main page-fade">
        <Outlet context={{ event, code }} />
      </div>
    </div>
  );
}

export default EventGuestShell;
