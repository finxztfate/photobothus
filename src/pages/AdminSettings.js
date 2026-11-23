import { useEffect, useState } from 'react';
import { apiRequest } from '../utils/api';
import { useAuth } from '../utils/auth';
import './Gallery.css';
import './AdminDashboard.css';

function AdminSettings() {
  const { user, replaceSession } = useAuth();
  const mustChangePassword = !!user?.mustChangePassword;
  const [error, setError] = useState('');
  const [systemMsg, setSystemMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [savingSystem, setSavingSystem] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [system, setSystem] = useState({
    maxGuestUploads: 4,
    maxEventUploads: 500,
    eventCreationEnabled: true,
    imageAccessTtlHours: 24,
  });
  const [password, setPassword] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    // Nothing loads until the default password has been replaced.
    if (mustChangePassword) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest('/api/admin/settings');
        if (!cancelled && data.settings) {
          setSystem({
            maxGuestUploads: data.settings.maxGuestUploads,
            maxEventUploads: data.settings.maxEventUploads,
            eventCreationEnabled: data.settings.eventCreationEnabled !== false,
            imageAccessTtlHours: data.settings.imageAccessTtlHours,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [mustChangePassword]);

  const handleSaveSystem = async (e) => {
    e.preventDefault();
    setSavingSystem(true);
    setError('');
    setSystemMsg('');
    try {
      const data = await apiRequest('/api/admin/settings', {
        method: 'PATCH',
        body: {
          maxGuestUploads: Number(system.maxGuestUploads),
          maxEventUploads: Number(system.maxEventUploads),
          eventCreationEnabled: !!system.eventCreationEnabled,
          imageAccessTtlHours: Number(system.imageAccessTtlHours),
        },
      });
      setSystem({
        maxGuestUploads: data.settings.maxGuestUploads,
        maxEventUploads: data.settings.maxEventUploads,
        eventCreationEnabled: data.settings.eventCreationEnabled !== false,
        imageAccessTtlHours: data.settings.imageAccessTtlHours,
      });
      setSystemMsg('Settings saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSystem(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSavingPassword(true);
    setError('');
    setPasswordMsg('');
    if (password.newPassword !== password.confirmPassword) {
      setError('New password and confirmation do not match');
      setSavingPassword(false);
      return;
    }
    try {
      const data = await apiRequest('/api/admin/change-password', {
        method: 'POST',
        body: {
          currentPassword: password.currentPassword,
          newPassword: password.newPassword,
        },
      });
      // The server answers with a fresh token that has full dashboard access.
      if (data.token) replaceSession(data.token, { mustChangePassword: false });
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordMsg('Password updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="admin-page dash-page">
      <header className="admin-header dash-header">
        <div>
          <h1>Settings</h1>
          <p>Admin account and system defaults for guests and protected images.</p>
        </div>
      </header>
      {mustChangePassword && (
        <p className="admin-error" role="alert">
          You signed in with the default admin password. Set a new one below to unlock the dashboard.
        </p>
      )}
      {error && <p className="admin-error">{error}</p>}
      {systemMsg && <p className="admin-success">{systemMsg}</p>}
      {passwordMsg && <p className="admin-success">{passwordMsg}</p>}

      <section className="dash-bottom-row">
        {/* System settings stay out of reach until the default password is replaced. */}
        <div className="dash-panel" hidden={mustChangePassword}>
          <div className="dash-panel-head">
            <div>
              <h2>System</h2>
              <p className="dash-muted">Applies to all events and image links.</p>
            </div>
          </div>
          <form className="dash-form" onSubmit={handleSaveSystem}>
            <label>
              Guest upload limit (per event)
              <input
                type="number"
                min="1"
                max="100"
                value={system.maxGuestUploads}
                onChange={(e) =>
                  setSystem((s) => ({ ...s, maxGuestUploads: e.target.value }))
                }
                placeholder="10"
                required
              />
            </label>
            <label className="dash-checkbox">
              <input
                type="checkbox"
                checked={!!system.eventCreationEnabled}
                onChange={(e) =>
                  setSystem((s) => ({ ...s, eventCreationEnabled: e.target.checked }))
                }
              />
              <span>Allow event creation</span>
            </label>
            <p className="dash-muted">
              Turn this off to stop new events. Existing events keep working.
            </p>
            <label>
              Event photo limit (all guests together)
              <input
                type="number"
                value={system.maxEventUploads}
                onChange={(e) =>
                  setSystem((s) => ({ ...s, maxEventUploads: e.target.value }))
                }
                placeholder="500"
                required
              />
            </label>
            <p className="dash-muted">
              Once an event holds this many photos, new uploads are refused until the host removes some.
            </p>
            <label>
              Image link expiry (hours)
              <input
                type="number"
                min="1"
                max="168"
                value={system.imageAccessTtlHours}
                onChange={(e) =>
                  setSystem((s) => ({ ...s, imageAccessTtlHours: e.target.value }))
                }
                placeholder="24"
                required
              />
            </label>
            <p className="dash-muted">
              Signed gallery image URLs expire after this many hours. Owners can still open images while logged in.
            </p>
            <button type="submit" disabled={savingSystem}>
              {savingSystem ? 'Saving…' : 'Save system settings'}
            </button>
          </form>
        </div>

        <div className="dash-panel">
          <div className="dash-panel-head">
            <div>
              <h2>Admin account</h2>
              <p className="dash-muted">{user?.email || '—'}</p>
            </div>
          </div>
          <form className="dash-form" onSubmit={handleChangePassword}>
            <label>
              Current password
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Current password"
                value={password.currentPassword}
                onChange={(e) =>
                  setPassword((p) => ({ ...p, currentPassword: e.target.value }))
                }
                required
              />
            </label>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                placeholder="At least 8 characters"
                value={password.newPassword}
                onChange={(e) =>
                  setPassword((p) => ({ ...p, newPassword: e.target.value }))
                }
                required
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                placeholder="Repeat the new password"
                value={password.confirmPassword}
                onChange={(e) =>
                  setPassword((p) => ({ ...p, confirmPassword: e.target.value }))
                }
                required
              />
            </label>
            <button type="submit" disabled={savingPassword}>
              {savingPassword ? 'Updating…' : 'Change password'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

export default AdminSettings;
