import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SparkleDivider from '../components/SparkleDivider';
import { apiRequest } from '../utils/api';
import './Spotlight.css';

function StarIcon() {
  return (
    <svg className="spot-badge-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg className="spot-creator-pin" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
    </svg>
  );
}

function formatSubmitted(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} - ${time}`;
}

function initials(name) {
  const letters = String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase());
  return letters.join('') || '•';
}

function Spotlight() {
  const [feature, setFeature] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest('/api/public/spotlight');
        if (!cancelled) setFeature(data.feature || null);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load Spotlight');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const details = feature?.details || {};
  const credit = feature?.credit || 'Customer';
  const meta = feature ? [
    { label: 'Submitted:', value: formatSubmitted(feature.createdAt) },
    { label: 'Filter used:', value: details.filter },
    { label: 'Layout:', value: details.layout },
  ].filter((item) => item.value) : [];
  const stripDetails = feature ? [
    { label: 'Layout', value: details.layout },
    { label: 'Frames', value: details.frames },
    { label: 'Filter', value: details.filter },
    { label: 'Camera', value: details.camera },
    { label: 'Device', value: details.device },
    { label: 'Edition', value: details.edition },
  ].filter((item) => item.value) : [];

  return (
    <div className="spotlight-page">
      <header className="spot-hero">
        <h1 className="spot-title">
          Photo of the <span className="spot-accent">Week</span>
        </h1>
        <p className="spot-subtitle">One strip, chosen from thousands.</p>
      </header>

      {loading ? (
        <p className="spot-empty">Loading…</p>
      ) : error ? (
        <p className="spot-empty">{error}</p>
      ) : !feature ? (
        <section className="spot-empty">
          <p>No photo of the week yet.</p>
          <p>
            <Link to="/gallery">Save a strip to My Gallery</Link> and allow it on Spotlight.
          </p>
        </section>
      ) : (
        <>
          <section className="spot-featured">
            <div className="spot-strip" role="img" aria-label="Photo of the week">
              <div className="spot-strip-frame spot-strip-frame--whole">
                <img src={feature.imageUrl} alt={details.quote || feature.title || 'Photo of the week'} />
              </div>
            </div>
            {details.quote && <blockquote className="spot-quote">“{details.quote}”</blockquote>}
            <p className="spot-credit">
              <span className="spot-credit-user">{credit}</span>
              {details.location && (
                <>
                  <span className="spot-credit-sep"> - </span>
                  <span className="spot-credit-location">{details.location}</span>
                </>
              )}
            </p>
          </section>

          <SparkleDivider className="spot-divider" />

          <section className="spot-info">
            {meta.length > 0 && (
              <dl className="spot-meta">
                {meta.map(({ label, value }) => (
                  <div className="spot-meta-item" key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}

            <span className="spot-badge">
              <StarIcon />
              Staff Pick
            </span>

            <article className="spot-creator">
              <span className="spot-creator-avatar" aria-hidden="true">{initials(credit)}</span>
              <div className="spot-creator-body">
                <h2 className="spot-creator-name">{credit}</h2>
                {details.location && (
                  <p className="spot-creator-location">
                    <PinIcon />
                    {details.location}
                  </p>
                )}
              </div>
            </article>

            {stripDetails.length > 0 && (
              <section className="spot-details" aria-labelledby="spot-details-title">
                <h3 className="spot-details-title" id="spot-details-title">Strip Details</h3>
                <dl className="spot-details-list">
                  {stripDetails.map(({ label, value }) => (
                    <div className="spot-details-row" key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </section>
        </>
      )}

      <section className="spot-next">
        <h2 className="spot-next-title">Up Next</h2>
        <p className="spot-next-text">
          New spotlight drops every Sunday. Submit yours before Saturday midnight.
        </p>
        <Link className="spot-next-btn" to="/gallery">Submit Your Entry</Link>
      </section>
    </div>
  );
}

export default Spotlight;
