import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/auth';
import './Welcome.css';

function firstName(user) {
  const fromName = String(user?.displayName || '').trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const fromEmail = String(user?.email || '').split('@')[0];
  return fromEmail || 'there';
}

function Welcome() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading } = useAuth();
  const [avatarReady, setAvatarReady] = useState(!user?.avatarUrl);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setAvatarReady(!user?.avatarUrl);
  }, [user?.avatarUrl]);

  if (loading) {
    return (
      <div className="welcome-page" aria-busy="true">
        <div className="welcome-panel welcome-panel-loading">
          <span className="welcome-spinner" aria-hidden="true" />
          <p>Getting your account ready…</p>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/signup" replace />;

  const name = firstName(user);
  const showAvatarSpinner = Boolean(user?.avatarUrl) && !avatarReady;

  const goHome = () => {
    if (leaving) return;
    setLeaving(true);
    navigate('/');
  };

  return (
    <div className="welcome-page">
      <div className="welcome-panel">
        <div className="welcome-avatar-wrap">
          {showAvatarSpinner && <span className="welcome-spinner welcome-spinner-avatar" aria-hidden="true" />}
          {user?.avatarUrl ? (
            <img
              className={`welcome-avatar${avatarReady ? '' : ' is-loading'}`}
              src={user.avatarUrl}
              alt=""
              onLoad={() => setAvatarReady(true)}
              onError={() => setAvatarReady(true)}
            />
          ) : (
            <div className="welcome-avatar welcome-avatar-fallback" aria-hidden="true">
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <p className="welcome-eyebrow">Account created</p>
        <h1>Welcome, {name}</h1>
        <p className="welcome-copy">
          Your Photobothus account is ready. Strips you save, events you host, and your account
          all live here from now on.
        </p>
        <button type="button" className="welcome-continue" onClick={goHome} disabled={leaving}>
          {leaving ? 'Opening Home…' : 'Continue to Home'}
        </button>
        <div className="welcome-next">
          <Link to="/layouts">Take a strip</Link>
          <Link to="/events/new">Host an event</Link>
        </div>
      </div>
    </div>
  );
}

export default Welcome;
