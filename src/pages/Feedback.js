import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { useAuth } from '../utils/auth';
import './AuthPages.css';
import './Feedback.css';

function Feedback() {
  const { user, isAuthenticated } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    setName((current) => current || user.displayName || '');
    setEmail((current) => current || user.email || '');
  }, [isAuthenticated, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiRequest('/api/public/feedback', {
        method: 'POST',
        body: { name, email, message },
      });
      setSent(true);
      setMessage('');
    } catch (err) {
      setError(err.message || 'Could not send feedback');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page feedback-page">
      <form className="auth-card auth-card-wide feedback-card" onSubmit={handleSubmit}>
        <p className="auth-kicker">Contact</p>
        <h1>Any feedback?</h1>
        <p className="auth-subtitle">
          Messages go to the Photobothus admin inbox. We read every note.
        </p>

        {sent ? (
          <div className="feedback-success" role="status">
            <p>Thanks — your message was sent to the admin.</p>
            <button type="button" onClick={() => setSent(false)}>
              Send another
            </button>
            <p className="auth-footer">
              <Link to="/">Back home</Link>
            </p>
          </div>
        ) : (
          <>
            <label>
              Name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
                maxLength={120}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                maxLength={255}
              />
            </label>
            <label>
              Message
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={6}
                required
                maxLength={4000}
                placeholder="Ideas, bugs, or anything we should know…"
              />
            </label>
            {error ? <p className="auth-error">{error}</p> : null}
            <button type="submit" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send to admin'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

export default Feedback;
