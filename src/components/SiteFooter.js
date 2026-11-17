import { Link } from 'react-router-dom';
import './SiteFooter.css';

function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link to="/" className="site-footer-brand">
        Photobooth.us
      </Link>
    </footer>
  );
}

export default SiteFooter;
