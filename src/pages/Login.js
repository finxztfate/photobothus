import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoogleSignInButton from '../components/GoogleSignInButton';
import './AuthPages.css';

function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Log in with Google</h1>
        <p className="auth-subtitle">
          Use an existing Photobothus account. Choosing a Google account here will not create a new one.
        </p>
        {error && <p className="auth-error">{error}</p>}
        <GoogleSignInButton
          mode="login"
          onSuccessNavigate={(user) => navigate(user.role === 'admin' ? '/admin' : '/')}
          onError={setError}
        />
        <p className="auth-footer">
          New here? <Link to="/signup">Sign up with Google</Link>
        </p>
        <p className="auth-footer">
          <Link to="/admin/login">Admin login</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
