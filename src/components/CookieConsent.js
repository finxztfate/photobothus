import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './CookieConsent.css';

const STORAGE_KEY = 'photobothus_cookie_consent';

function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return;
    } catch {
      /* private mode */
    }
    setVisible(true);
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-consent" role="dialog" aria-label="Cookie notice">
      <p>
        We use cookies and similar storage to keep you signed in and remember basic site preferences.{' '}
        <Link to="/privacy">Privacy</Link>
      </p>
      <button type="button" className="cookie-consent-accept" onClick={accept}>
        Accept
      </button>
    </div>
  );
}

export default CookieConsent;
