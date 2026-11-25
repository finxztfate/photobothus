import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SparkleDivider from '../components/SparkleDivider';
import LayoutPreview from '../components/LayoutPreview';
import { apiRequest } from '../utils/api';
import { useAuth } from '../utils/auth';
import './Layout.css';
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

function HeartIcon({ filled }) {
  return (
    <svg className="spot-heart-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        d="M12.1 21s-6.7-4.4-9.5-8.4C.4 9.4 1.4 5.6 4.6 4.4c1.9-.7 4.1 0 7.5 3.4 3.4-3.4 5.6-4.1 7.5-3.4 3.2 1.2 4.2 5 2 8.2-2.8 4-9.5 8.4-9.5 8.4z"
      />
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

function socialHref(network, social) {
  if (!social) return null;
  if (/^https?:\/\//i.test(social)) return social;
  const handle = String(social).replace(/^@/, '');
  if (network === 'facebook') return `https://www.facebook.com/${encodeURIComponent(handle)}`;
  return `https://www.instagram.com/${encodeURIComponent(handle)}/`;
}

function socialDisplay(network, social) {
  if (!social) return '';
  if (/^https?:\/\//i.test(social)) return network === 'facebook' ? 'Facebook' : 'Instagram';
  const handle = String(social).replace(/^@/, '');
  return network === 'facebook' ? handle : `@${handle}`;
}

function initials(name) {
  const letters = String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase());
  return letters.join('') || '•';
}

function stripPhotos(item) {
  return (item?.photoUrls || []).map((src) => ({ src }));
}

function StripFrame({ item, label, compact = false }) {
  const photos = stripPhotos(item);
  const useLayout = item.layoutId != null && photos.length > 1;

  return (
    <div className={`spot-strip${compact ? ' spot-strip--entry' : ''}`} role="img" aria-label={label}>
      {useLayout ? (
        <LayoutPreview
          className="spot-layout"
          layout={item.layoutId}
          photos={photos}
        />
      ) : (
        <div className="spot-strip-frame spot-strip-frame--whole">
          {item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}
        </div>
      )}
    </div>
  );
}

function Spotlight() {
  const { isAuthenticated } = useAuth();
  const [feature, setFeature] = useState(null);
  const [entries, setEntries] = useState([]);
  const [week, setWeek] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest('/api/public/spotlight');
        if (cancelled) return;
        setFeature(data.feature || null);
        setEntries(data.entries || []);
        setWeek(data.week || null);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load Spotlight');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const applyLike = (stripId, liked, likeCount) => {
    const patch = (item) => (
      item && item.stripId === stripId ? { ...item, likedByMe: liked, likeCount } : item
    );
    setFeature((prev) => patch(prev));
    setEntries((prev) => prev.map(patch));
  };

  const toggleLike = async (item) => {
    if (!isAuthenticated) return;
    setBusyId(item.stripId);
    setError('');
    try {
      const data = item.likedByMe
        ? await apiRequest(`/api/spotlight/likes/${item.stripId}`, { method: 'DELETE' })
        : await apiRequest('/api/spotlight/likes', {
          method: 'POST',
          body: { stripId: item.stripId },
        });
      applyLike(item.stripId, !!data.liked, Number(data.likeCount || 0));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const details = feature?.details || {};
  const credit = feature?.credit || 'Customer';
  const socialUrl = socialHref(details.socialNetwork, details.social);
  const socialText = socialDisplay(details.socialNetwork, details.social);
  const meta = feature ? [
    { label: 'Submitted:', value: formatSubmitted(feature.createdAt) },
    { label: 'Location:', value: details.location },
    { label: 'Layout:', value: details.layout },
    { label: 'Device:', value: details.device },
  ].filter((item) => item.value) : [];
  const stripDetails = feature ? [
    { label: 'Quote', value: details.quote },
    { label: 'Location', value: details.location },
    { label: 'Layout', value: details.layout },
    { label: 'Device', value: details.device },
    {
      label: details.socialNetwork === 'facebook' ? 'Facebook' : 'Instagram',
      value: socialText,
      href: socialUrl,
    },
  ].filter((item) => item.value) : [];
  const endsLabel = week?.endsAt
    ? new Date(week.endsAt).toLocaleString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: week.tz || 'Asia/Manila',
    })
    : 'Sunday midnight';

  return (
    <div className="spotlight-page">
      <header className="spot-hero">
        <h1 className="spot-title">
          Photo of the <span className="spot-accent">Week</span>
        </h1>
        <p className="spot-subtitle">Voted by the community. A strip needs 10 hearts to be Photo of the Week.</p>
      </header>

      {loading ? (
        <p className="spot-empty">Loading…</p>
      ) : error && !feature && !entries.length ? (
        <p className="spot-empty">{error}</p>
      ) : !feature ? (
        <section className="spot-vacant" aria-label="No photo of the week yet">
          <div className="spot-vacant-strip" aria-hidden="true">
            <LayoutPreview layout={1} photos={[]} className="spot-vacant-preview" />
          </div>
          <div className="spot-vacant-copy">
            <p className="spot-vacant-kicker">Crown empty</p>
            <h2 className="spot-vacant-title">No Photo of the Week yet</h2>
            <p className="spot-vacant-text">
              Need {week?.winMinLikes || 10} hearts to take the crown. Heart entries below — or submit yours from Gallery.
            </p>
            <Link className="spot-vacant-cta" to={isAuthenticated ? '/gallery' : '/layouts'}>
              {isAuthenticated ? 'Enter from Gallery' : 'Start a strip'}
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="spot-featured">
            <StripFrame item={feature} label="Photo of the week" />
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
              Community Pick
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
                {socialUrl && (
                  <p className="spot-creator-handle">
                    <a href={socialUrl} target="_blank" rel="noopener noreferrer">
                      {socialText}
                    </a>
                  </p>
                )}
              </div>
            </article>

            {stripDetails.length > 0 && (
              <section className="spot-details" aria-labelledby="spot-details-title">
                <h3 className="spot-details-title" id="spot-details-title">Strip Details</h3>
                <dl className="spot-details-list">
                  {stripDetails.map(({ label, value, href }) => (
                    <div className="spot-details-row" key={label}>
                      <dt>{label}</dt>
                      <dd>
                        {href ? (
                          <a href={href} target="_blank" rel="noopener noreferrer">{value}</a>
                        ) : value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </section>
        </>
      )}

      <section className="spot-contest" aria-labelledby="spot-contest-title">
        <div className="spot-contest-panel">
        <h2 className="spot-contest-title" id="spot-contest-title">This week’s entries</h2>
        <p className="spot-contest-text">
          Heart your favorites — voting ends Saturday midnight
          {week?.tz ? ` (${week.tz})` : ''}. Need {week?.winMinLikes || 10} hearts to win;
          crowned {endsLabel}. One entry each; the board resets weekly.
        </p>
        {error && feature ? <p className="spot-empty">{error}</p> : null}
        <div className="spot-contest-grid spot-contest-mosaic">
          {entries.map((item) => (
            <article key={item.stripId} className="spot-entry">
              <StripFrame compact item={item} label={item.title || 'Spotlight entry'} />
              <div className="spot-entry-bar">
                <p className="spot-entry-credit">{item.credit}</p>
                {isAuthenticated ? (
                  <button
                    type="button"
                    className={`spot-like${item.likedByMe ? ' is-liked' : ''}`}
                    onClick={() => toggleLike(item)}
                    disabled={busyId === item.stripId}
                    aria-pressed={!!item.likedByMe}
                    aria-label={item.likedByMe ? 'Unlike' : 'Like'}
                  >
                    <HeartIcon filled={!!item.likedByMe} />
                    <span>{item.likeCount || 0}</span>
                  </button>
                ) : (
                  <Link className="spot-like" to="/login">
                    <HeartIcon filled={false} />
                    <span>{item.likeCount || 0}</span>
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
        {!entries.length && !loading && (
          <div className="spot-entries-empty" role="status">
            <div className="spot-entries-empty-mark" aria-hidden="true">♡</div>
            <h3 className="spot-entries-empty-title">The board is quiet</h3>
            <p className="spot-entries-empty-text">
              No strips in this week’s race yet. Be the first — one entry per person.
            </p>
            <Link className="spot-vacant-cta spot-vacant-cta--compact" to={isAuthenticated ? '/gallery' : '/login'}>
              {isAuthenticated ? 'Submit an entry' : 'Log in to enter'}
            </Link>
          </div>
        )}
        </div>
      </section>

      <section className="spot-next">
        <h2 className="spot-next-title">Up Next</h2>
        <p className="spot-next-text">
          New community winner every Sunday at midnight — only if a strip reaches {week?.winMinLikes || 10} hearts.
          Enter one strip from your gallery before Saturday midnight.
        </p>
        <Link className="spot-next-btn" to="/gallery">Submit Your Entry</Link>
      </section>
    </div>
  );
}

export default Spotlight;
