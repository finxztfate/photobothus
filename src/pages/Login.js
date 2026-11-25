import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoogleSignInButton from '../components/GoogleSignInButton';
import './AuthPages.css';

function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsPulse, setTermsPulse] = useState(false);

  const nudgeTerms = () => {
    setError('Agree to the Terms of Use and Privacy Policy to continue.');
    setTermsPulse(true);
    window.setTimeout(() => setTermsPulse(false), 700);
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--signup">
        <p className="auth-kicker">Account</p>
        <h1>Log in with Google</h1>
        <p className="auth-subtitle">
          Use an existing Photobothus account. Choosing a Google account here will not create a new one.
        </p>

        {error && <p className="auth-error">{error}</p>}

        <div className="auth-signup-google">
          {!acceptedTerms && (
            <div
              className="auth-signup-gate"
              role="button"
              tabIndex={0}
              aria-label="Agree to terms before logging in"
              onClick={nudgeTerms}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  nudgeTerms();
                }
              }}
            />
          )}
          <GoogleSignInButton
            mode="login"
            acceptTerms={acceptedTerms}
            disabled={!acceptedTerms}
            onSuccessNavigate={(user) => navigate(user.role === 'admin' ? '/admin' : '/')}
            onError={setError}
          />
        </div>

        <label className={`auth-checkbox auth-checkbox--terms${termsPulse ? ' is-pulse' : ''}${acceptedTerms ? ' is-on' : ''}`}>
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => {
              setAcceptedTerms(event.target.checked);
              setError('');
            }}
          />
          <span>
            I agree to the{' '}
            <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms of Use</Link>
            {' '}and{' '}
            <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>.
          </span>
        </label>

        <p className="auth-footer">
          New here? <Link to="/signup">Sign up with Google</Link>
        </p>
        <p className="auth-footer auth-footer--quiet">
          <Link to="/admin/login">Admin login</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
