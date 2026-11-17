import { useEffect, useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../utils/auth';

const MAX_BUTTON_WIDTH = 352;

function GoogleSignInButton({ onSuccessNavigate, onError }) {
  const { loginWithGoogle } = useAuth();
  const wrapRef = useRef(null);
  const [buttonWidth, setButtonWidth] = useState(MAX_BUTTON_WIDTH);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const measure = () => {
      const available = Math.floor(wrap.clientWidth);
      if (available > 0) setButtonWidth(Math.min(MAX_BUTTON_WIDTH, available));
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(wrap);
    return () => observer?.disconnect();
  }, []);

  if (!process.env.REACT_APP_GOOGLE_CLIENT_ID) {
    return (
      <p className="auth-error">
        Google sign-in is not configured. Set <code>REACT_APP_GOOGLE_CLIENT_ID</code> in `.env`.
      </p>
    );
  }

  return (
    <div className="google-btn-wrap" ref={wrapRef}>
      <GoogleLogin
        key={buttonWidth}
        onSuccess={async (response) => {
          try {
            const user = await loginWithGoogle(response.credential);
            onSuccessNavigate?.(user);
          } catch (err) {
            onError?.(err.message || 'Google sign-in failed');
          }
        }}
        onError={() => onError?.('Google sign-in was cancelled or failed')}
        useOneTap={false}
        theme="outline"
        size="large"
        text="continue_with"
        shape="rectangular"
        width={String(buttonWidth)}
      />
    </div>
  );
}

export default GoogleSignInButton;
