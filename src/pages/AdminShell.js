import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/auth';
import ThemeToggle from '../components/ThemeToggle';
import ConfirmModal from '../components/ConfirmModal';
import './Gallery.css';
import './AdminDashboard.css';

const NAV = [
  { to: '/admin', label: 'Home', end: true },
  { to: '/admin/users', label: 'Customers' },
  { to: '/admin/events', label: 'Events' },
  { to: '/admin/spotlight', label: 'Spotlight' },
  { to: '/admin/payments', label: 'Payments' },
  { to: '/admin/settings', label: 'Settings' },
];

function AdminShell({ theme = 'dark', toggleTheme }) {
  const { isAdmin, loading, logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  if (loading) {
    return (
      <div className="admin-shell">
        <p className="admin-loading">Loading…</p>
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/admin/login" replace />;
  // Signed in with the default password: Settings is the only page that works
  // until a new password is set, so send every other admin page there.
  if (user?.mustChangePassword && location.pathname !== '/admin/settings') {
    return <Navigate to="/admin/settings" replace />;
  }

  const firstName =
    (user?.displayName || user?.email || 'Admin').split(/[\s@]/)[0] || 'Admin';

  return (
    <div className={`admin-shell${menuOpen ? ' admin-menu-open' : ''}`}>
      <header className="admin-topbar">
        <div className="admin-topbar-start">
          <button
            type="button"
            className="admin-menu-btn"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
          <Link to="/admin" className="admin-topbar-brand" onClick={() => setMenuOpen(false)}>
            PHOTOBOTHUS
          </Link>
        </div>
        <div className="admin-topbar-actions">
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
          <button
            type="button"
            className="admin-topbar-logout"
            onClick={() => setConfirmLogout(true)}
          >
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
                logout();
                navigate('/admin/login');
              }}
            />
          )}
        </div>
      </header>

      {menuOpen ? (
        <button
          type="button"
          className="admin-nav-overlay"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className="admin-body">
        <aside
          className={`admin-aside${menuOpen ? ' is-open' : ''}`}
          aria-label="Admin navigation"
        >
          <p className="admin-aside-label">Menu</p>
          <nav className="admin-aside-nav">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'is-active' : undefined)}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          {user?.email ? <p className="admin-aside-user">{user.email}</p> : null}
        </aside>

        <main className="admin-main">
          <div key={location.pathname} className="page-fade">
            <Outlet context={{ firstName }} />
          </div>
        </main>
      </div>

      <footer className="admin-footer">PHOTOBOOTH.US</footer>
    </div>
  );
}

export default AdminShell;
