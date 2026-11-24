import { Link } from 'react-router-dom';
import './SystemStatusPage.css';

const COPY = {
  crash: {
    kicker: 'System error',
    title: 'Something went wrong on our side',
    body: 'The page hit an unexpected problem. Reloading usually clears it.',
  },
  offline: {
    kicker: 'Unavailable',
    title: 'Photobothus can’t reach the server',
    body: 'Check your connection, or try again in a moment. If this keeps happening, the service may be down.',
  },
  notFound: {
    kicker: '404',
    title: 'Page not found',
    body: 'That link doesn’t lead anywhere in Photobothus.',
  },
};

function SystemStatusPage({
  kind = 'crash',
  title,
  body,
  showReload = kind === 'crash' || kind === 'offline',
  homeTo = '/',
}) {
  const preset = COPY[kind] || COPY.crash;

  return (
    <div className="system-status-page">
      <div className="system-status-card">
        <p className="system-status-kicker">{preset.kicker}</p>
        <h1>{title || preset.title}</h1>
        <p className="system-status-body">{body || preset.body}</p>
        <div className="system-status-actions">
          {showReload ? (
            <button type="button" className="system-status-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          ) : null}
          <Link to={homeTo} className="system-status-secondary">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default SystemStatusPage;
