import { useState } from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from '../../../../components/ThemeToggle';
import ConfirmModal from '../../../../components/ConfirmModal';

function EventHostShell({
  event,
  userEmail,
  showShare,
  onToggleShare,
  onLogout,
  children,
  theme = 'dark',
  toggleTheme,
}) {
  const [confirmLogout, setConfirmLogout] = useState(false);

  return (
    <div className="event-host-shell">
      <header className="event-host-topbar">
        <Link to="/events" className="event-host-brand">
          PHOTOBOTHUS
        </Link>
        <div className="event-host-topbar-actions">
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
          <button type="button" className="event-host-logout" onClick={() => setConfirmLogout(true)}>
            Log out
          </button>
          {confirmLogout && (
            <ConfirmModal
              title="Log out?"
              message="Are you sure?"
              confirmLabel="Log out"
              onCancel={() => setConfirmLogout(false)}
              onConfirm={() => {
                setConfirmLogout(false);
                onLogout();
              }}
            />
          )}
        </div>
      </header>

      <nav className="event-host-subnav" aria-label="Event navigation">
        <Link to="/events" className="is-active">
          Home
        </Link>
        {event && (
          <>
            <Link to={`/events/${event.id}/edit`}>Edit</Link>
            <Link to={`/e/${event.code}`}>Event</Link>
            {event.isActive && (
              <button type="button" className="event-host-subnav-btn" onClick={onToggleShare}>
                Share QR
              </button>
            )}
          </>
        )}
        <span className="event-host-subnav-spacer" />
        {userEmail ? <span className="event-host-user">{userEmail}</span> : null}
      </nav>

      <main className="event-host-main">{children}</main>

      <footer className="event-host-footer">PHOTOBOOTH.US</footer>
    </div>
  );
}

export default EventHostShell;