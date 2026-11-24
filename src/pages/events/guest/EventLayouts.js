import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import LayoutPreview from '../../../components/LayoutPreview';
import { apiRequest } from '../../../utils/api';
import { layoutsAllowedForGuest } from '../../../utils/eventLayoutCapacity';
import '../../Layout.css';

function EventLayouts() {
  const { code } = useParams();
  const navigate = useNavigate();
  const outlet = useOutletContext() || {};
  const [event, setEvent] = useState(outlet.event || null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!outlet.event);

  useEffect(() => {
    if (!code) return undefined;
    sessionStorage.setItem('eventCode', code);
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest(`/api/public/events/${code}`);
        if (!cancelled) {
          setEvent(data.event);
          setError('');
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Event not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  function handleSelectLayout(layoutId) {
    sessionStorage.setItem('eventCode', code);
    navigate(`/e/${code}/photobooth?layout=${layoutId}`);
  }

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

  if (loading || !event) {
    return (
      <div className="layouts-page event-layouts-page">
        <p className="layouts-subheading">Loading layouts…</p>
      </div>
    );
  }

  const layouts = layoutsAllowedForGuest(event.allowedLayouts);

  return (
    <div className="layouts-page event-layouts-page">
      <p className="event-layouts-eyebrow">
        Event photobooth · {event.name}
      </p>
      <h2 className="layouts-heading">Layouts</h2>
      <p className="layouts-subheading">Choose a layout for this event</p>

      <div className="layouts-grid">
        {layouts.map((layout) => (
          <button
            key={layout.id}
            type="button"
            className="layout-option"
            onClick={() => handleSelectLayout(layout.id)}
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
    </div>
  );
}

export default EventLayouts;
