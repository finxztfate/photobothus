import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoogleSignInButton from '../components/GoogleSignInButton';
import './AuthPages.css';

function Signup() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Sign up with Google</h1>
        <p className="auth-subtitle">Use your Google account to save strips and host events.</p>
        {error && <p className="auth-error">{error}</p>}
        <GoogleSignInButton
          onSuccessNavigate={(user) => navigate(user.role === 'admin' ? '/admin' : '/')}
          onError={setError}
        />
        <p className="auth-footer">
          Already have an account? <Link to="/login">Log in with Google</Link>
        </p>
        <p className="auth-footer">
          <Link to="/admin/login">Admin login</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
