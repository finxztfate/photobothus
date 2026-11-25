import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoogleSignInButton from '../components/GoogleSignInButton';
import './AuthPages.css';

function Signup() {
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
        <h1>Sign up with Google</h1>
        <p className="auth-subtitle">
          Creates your Photobothus account in one step. Pick the Google account you want to use.
        </p>

        {error && <p className="auth-error">{error}</p>}

        <div className="auth-signup-google">
          {!acceptedTerms && (
            <div
              className="auth-signup-gate"
              role="button"
              tabIndex={0}
              aria-label="Agree to terms before signing up"
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
            mode="signup"
            acceptTerms={acceptedTerms}
            disabled={!acceptedTerms}
            onSuccessNavigate={(user) => navigate(user.role === 'admin' ? '/admin' : '/welcome', { replace: true })}
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
          Already have an account? <Link to="/login">Log in with Google</Link>
        </p>
        <p className="auth-footer auth-footer--quiet">
          <Link to="/admin/login">Admin login</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
