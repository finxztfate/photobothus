import { Link } from 'react-router-dom';
import './SiteFooter.css';

function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link to="/" className="site-footer-brand">
        Photobooth.us
      </Link>
      <nav className="site-footer-links" aria-label="Legal">
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
      </nav>
    </footer>
  );
}

export default SiteFooter;
