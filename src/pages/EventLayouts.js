import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { STRIP_LAYOUTS } from '../data/stripLayouts';
import LayoutPreview from '../components/LayoutPreview';
import { apiRequest } from '../utils/api';
import './Layout.css';

function EventLayouts() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(1);

  useEffect(() => {
    if (!code) return;
    sessionStorage.setItem('eventCode', code);
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest(`/api/public/events/${code}`);
        if (!cancelled) {
          setEvent(data.event);
          if (data.event && !data.event.stripsEnabled) {
            navigate(`/e/${code}/photobooth?layout=3`, { replace: true });
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Event not found');
      }
    })();
    return () => { cancelled = true; };
  }, [code, navigate]);

  const handleUseLayout = () => {
    sessionStorage.setItem('eventCode', code);
    navigate(`/e/${code}/photobooth?layout=${selectedId}`);
  };

  if (error) {
    return (
      <div className="page-layout">
        <div className="page" style={{ display: 'block', padding: 40, textAlign: 'center' }}>
          <h1>Event unavailable</h1>
          <p>{error}</p>
          <Link to="/">Back home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="layouts-page event-layouts-page">
      <p className="event-layouts-eyebrow">
        {event ? `Event photobooth · ${event.name}` : 'Event photobooth'}
      </p>
      <h2 className="layouts-heading">Layouts</h2>
      <p className="layouts-subheading">Choose a layout for this event</p>

      <div className="layouts-grid">
        {STRIP_LAYOUTS.map((layout) => (
          <button
            key={layout.id}
            type="button"
            className={`layout-option ${selectedId === layout.id ? 'is-selected' : ''}`}
            onClick={() => setSelectedId(layout.id)}
          >
            <LayoutPreview layout={layout} />
            <span className="layout-label">
              {layout.label.map((line) => (
                <span key={line}>
                  {line}
                  <br />
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>

      <div className="layouts-actions">
        <Link to={`/e/${code}`} className="layouts-secondary-btn">
          Back to event
        </Link>
        <button type="button" className="cta-btn layouts-cta" onClick={handleUseLayout}>
          Start Booth
        </button>
      </div>
    </div>
  );
}

export default EventLayouts;
