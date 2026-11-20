import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Home from './pages/Home';
import Spotlight from './pages/Spotlight';
import Photobooth from './pages/Photobooth';
import Layout from './pages/Layout';
import EditPage from './pages/EditPage';
import About from './pages/About';
import Faq from './pages/Faq';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Welcome from './pages/Welcome';
import MyGallery from './pages/MyGallery';
import {
  EventHostListPage,
  EventHostDetailPage,
  EventHostCreatePage,
  EventHostEditPage,
} from './pages/events/host';
import EventPublic from './pages/EventPublic';
import EventLayouts from './pages/EventLayouts';
import EventPhotobooth from './pages/EventPhotobooth';
import EventEditor from './pages/EventEditor';
import EventGuestShell from './pages/EventGuestShell';
import AdminLogin from './pages/AdminLogin';
import AdminShell from './pages/AdminShell';
import AdminOverview from './pages/AdminOverview';
import AdminUsers from './pages/AdminUsers';
import AdminEvents from './pages/AdminEvents';
import AdminPayments from './pages/AdminPayments';
import AdminSettings from './pages/AdminSettings';
import AdminSpotlight from './pages/AdminSpotlight';
import SiteFooter from './components/SiteFooter';
import LoadingModal from './components/LoadingModal';
import ConfirmModal from './components/ConfirmModal';
import ThemeToggle from './components/ThemeToggle';
import { AuthProvider, useAuth } from './utils/auth';
import { SPOTLIGHT_ENABLED } from './data/features';
import './App.css';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  ...(SPOTLIGHT_ENABLED ? [{ to: '/spotlight', label: 'Spotlight' }] : []),
  { to: '/layouts', label: 'Layouts' },
  { to: '/about', label: 'About' },
  { to: '/faq', label: 'FAQ' },
];

const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
const THEME_FADE_MS = 450;

function App() {
  const [theme, setTheme] = useState('dark');
  const fadeTimerRef = useRef(null);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      setTheme(nextTheme);
      return;
    }

    if (document.startViewTransition) {
      document.startViewTransition(() => {
        flushSync(() => setTheme(nextTheme));
      });
      return;
    }

    const root = document.documentElement;
    root.classList.add('theme-fading');
    clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => root.classList.remove('theme-fading'), THEME_FADE_MS);
    setTheme(nextTheme);
  };
  const navProps = { theme, toggleTheme };

  return (
    <GoogleOAuthProvider clientId={googleClientId || 'missing-client-id'}>
      <AuthProvider>
        <Router>
          <div className="App" data-theme={theme}>
            <LoadingModal />
            <Routes>
              <Route path="/" element={<SitePage className="page-home" {...navProps}><Home /></SitePage>} />
              <Route
                path="/spotlight"
                element={
                  SPOTLIGHT_ENABLED
                    ? <SitePage className="page-spotlight" {...navProps}><Spotlight /></SitePage>
                    : <Navigate to="/" replace />
                }
              />
              <Route path="/photobooth" element={
                <div className="page-photobooth-wrapper page-fade">
                  <Photobooth theme={theme} toggleTheme={toggleTheme} />
                </div>
              } />
              <Route path="/layouts" element={<SitePage className="page-layout" {...navProps}><Layout /></SitePage>} />
              <Route path="/about" element={<SitePage className="page-about" {...navProps}><About /></SitePage>} />
              <Route path="/faq" element={<SitePage className="page-faq" {...navProps}><Faq /></SitePage>} />
              <Route path="/login" element={<SitePage className="page-home" {...navProps}><Login /></SitePage>} />
              <Route path="/signup" element={<SitePage className="page-home" {...navProps}><Signup /></SitePage>} />
              <Route path="/welcome" element={<SitePage className="page-home" {...navProps}><Welcome /></SitePage>} />
              <Route path="/gallery" element={<SitePage className="page-home" {...navProps}><MyGallery /></SitePage>} />
              {/* Host event management (logged-in customer) */}
              <Route path="/events" element={<SitePage className="page-home" {...navProps}><EventHostListPage /></SitePage>} />
              <Route path="/events/new" element={<SitePage className="page-home" {...navProps}><EventHostCreatePage /></SitePage>} />
              <Route path="/events/:id/edit" element={<SitePage className="page-home" {...navProps}><EventHostEditPage /></SitePage>} />
              <Route path="/events/:id" element={<EventHostDetailPage {...navProps} />} />

              {/* Guest event flow — own shell + pages (not site navbar / normal booth) */}
              <Route path="/e/:code" element={<EventGuestShell />}>
                <Route index element={<EventPublic />} />
                <Route path="layouts" element={<div className="page-layout"><EventLayouts /></div>} />
                <Route path="photobooth" element={
                  <div className="page-event-photobooth-wrapper">
                    <EventPhotobooth />
                  </div>
                } />
                <Route path="editor" element={<EventEditor />} />
              </Route>

              <Route path="/editor" element={<div className="page-fade"><EditPage /></div>} />
              <Route path="/admin/login" element={<div className="page-fade"><AdminLogin /></div>} />
              <Route path="/admin" element={<AdminShell {...navProps} />}>
                <Route index element={<AdminOverview />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="strips" element={<Navigate to="/admin" replace />} />
                <Route path="spotlight" element={<AdminSpotlight />} />
                <Route path="events" element={<AdminEvents />} />
                <Route path="payments" element={<AdminPayments />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

function SitePage({ className, theme, toggleTheme, children }) {
  const location = useLocation();

  return (
    <div className={`site-page ${className}`}>
      <AppNavbar theme={theme} toggleTheme={toggleTheme} />
      <div key={location.pathname} className="page-fade">
        {children}
      </div>
      <SiteFooter />
    </div>
  );
}

function AppNavbar({ theme, toggleTheme }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isCustomer, isAdmin, logout, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const links = [
    ...NAV_LINKS,
    ...(isCustomer ? [
      { to: '/events', label: 'Event Dashboard' },
      { to: '/gallery', label: 'Gallery' },
    ] : []),
  ];

  return (
    <header className={`navbar${menuOpen ? ' is-menu-open' : ''}`}>
      <Link to="/" className="logo">
        <span className="logo-text">Photobothus</span>
      </Link>

      <div className={`nav-menu${menuOpen ? ' is-open' : ''}`} id="site-nav-menu">
        <nav className="nav-links">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={location.pathname === to ? 'active' : ''}
            >
              {label}
            </Link>
          ))}
          {!loading && isAuthenticated && isAdmin && <Link to="/admin">Admin</Link>}
        </nav>

        <div className="nav-actions">
          {!loading && (
            isAuthenticated ? (
              <>
                <span className="nav-user">{user?.displayName || user?.email}</span>
                <button
                  type="button"
                  className="nav-auth-btn"
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
                      navigate('/');
                    }}
                  />
                )}
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className={`nav-login${location.pathname === '/login' ? ' active' : ''}`}
                >
                  Log in
                </Link>
                <Link to="/signup" className="nav-signup">Sign up</Link>
              </>
            )
          )}

          <ThemeToggle theme={theme} toggleTheme={toggleTheme} className="nav-desktop-only" />
        </div>
      </div>

      <div className="nav-mobile-tools">
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        <button
          type="button"
          className="nav-burger"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="site-nav-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="nav-burger-line" />
          <span className="nav-burger-line" />
          <span className="nav-burger-line" />
        </button>
      </div>

      {menuOpen && <div className="nav-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
    </header>
  );
}

export default App;
