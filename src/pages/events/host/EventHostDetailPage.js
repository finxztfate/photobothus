import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { apiRequest, downloadFile } from '../../../utils/api';
import { useAuth } from '../../../utils/auth';
import EventHostShell from './components/EventHostShell';
import EventHostWelcomeBar from './components/EventHostWelcomeBar';
import EventHostStatsGrid from './components/EventHostStatsGrid';
import EventHostShareQrPanel from './components/EventHostShareQrPanel';
import EventHostGallery from './components/EventHostGallery';
import './EventHostDetailPage.css';

function EventHostDetailPage({ theme, toggleTheme }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isCustomer, loading, logout, user } = useAuth();
  const [event, setEvent] = useState(null);
  const [strips, setStrips] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [activeTab, setActiveTab] = useState('gallery');
  const [removingId, setRemovingId] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const eventUrl = useMemo(() => {
    if (!event?.code) return '';
    return `${window.location.origin}/e/${event.code}/photobooth`;
  }, [event]);

  // The gallery loads a page at a time, so the totals come from the event itself.
  const stripCount = event?.stripCount ?? strips.length;
  const guestCount = event?.guestCount ?? 0;

  // Runs on open and every few seconds: refreshes the totals and the newest page.
  const load = useCallback(async ({ silent = false } = {}) => {
    const [eventData, stripsData] = await Promise.all([
      apiRequest(`/api/events/${id}`, { silent }),
      apiRequest(`/api/events/${id}/strips`, { silent }),
    ]);
    const newest = stripsData.strips || [];
    setEvent(eventData.event);
    setStrips((prev) => {
      if (!newest.length) return [];
      // Photos already on screen keep their entry, so their images are not reloaded.
      const known = new Map(prev.map((strip) => [strip.id, strip]));
      const oldestNewId = newest[newest.length - 1].id;
      return [
        ...newest.map((strip) => known.get(strip.id) || strip),
        // Older pages the host already opened with "Load more" stay in place.
        ...prev.filter((strip) => strip.id < oldestNewId),
      ];
    });
  }, [id]);

  const loadMore = async () => {
    const last = strips[strips.length - 1];
    if (!last) return;
    setLoadingMore(true);
    setError('');
    try {
      const data = await apiRequest(`/api/events/${id}/strips?before=${last.id}`);
      setStrips((prev) => {
        const known = new Set(prev.map((strip) => strip.id));
        return [...prev, ...(data.strips || []).filter((strip) => !known.has(strip.id))];
      });
    } catch (err) {
      setError(err.message || 'Could not load more photos');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (event && !event.isActive) {
      setShowShare(false);
      setActiveTab((tab) => (tab === 'share' ? 'gallery' : tab));
    }
  }, [event]);

  useEffect(() => {
    if (!isAuthenticated || !isCustomer) return;
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();

    const timer = setInterval(() => {
      load({ silent: true }).catch(() => {});
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isAuthenticated, isCustomer, load]);

  const toggleActive = async () => {
    if (!event) return;
    setBusy(true);
    try {
      const data = await apiRequest(`/api/events/${id}`, {
        method: 'PATCH',
        body: { isActive: !event.isActive },
      });
      // The reply has no guest total, so keep the one already shown.
      setEvent((prev) => ({ ...prev, ...data.event }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy link');
    }
  };

  const downloadAll = async () => {
    if (!stripCount) return;
    setDownloading(true);
    setError('');
    try {
      // One ZIP with every photo of the event, built by the server.
      const safeName =
        String(event?.name || '')
          .replace(/[^\w.-]+/g, '_')
          .replace(/^[_.]+|[_.]+$/g, '') || 'event';
      await downloadFile(`/api/events/${id}/download`, `${safeName}-photos.zip`);
    } catch (err) {
      setError(err.message || 'Could not download photos');
    } finally {
      setDownloading(false);
    }
  };

  const removeStrip = async (strip) => {
    if (!window.confirm('Remove this photo from the event gallery? This cannot be undone.')) return;
    setRemovingId(strip.id);
    setError('');
    try {
      await apiRequest(`/api/events/${id}/strips/${strip.id}`, { method: 'DELETE' });
      setStrips((prev) => prev.filter((item) => item.id !== strip.id));
      setEvent((prev) =>
        prev ? { ...prev, stripCount: Math.max(0, (prev.stripCount ?? 1) - 1) } : prev
      );
    } catch (err) {
      setError(err.message || 'Could not remove photo');
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <EventHostShell theme={theme} toggleTheme={toggleTheme}>
        <div className="event-host-loading-state">
          <div className="event-host-spinner" />
          <p>Loading event dashboard…</p>
        </div>
      </EventHostShell>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isCustomer) return <Navigate to="/admin" replace />;

  return (
    <EventHostShell
      event={event}
      userEmail={user?.email}
      showShare={showShare}
      onToggleShare={() => setShowShare((v) => !v)}
      onLogout={() => {
        logout();
        navigate('/login');
      }}
      theme={theme}
      toggleTheme={toggleTheme}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {error && <div className="event-host-toast error">{error}</div>}

      {!event ? (
        <div className="event-host-loading-state">
          <div className="event-host-spinner" />
          <p>Loading event…</p>
        </div>
      ) : (
        <div key={id} className="page-fade">
          <EventHostWelcomeBar
            event={event}
            copied={copied}
            busy={busy}
            onCopyLink={copyLink}
            onToggleActive={toggleActive}
          />

          <EventHostStatsGrid
            event={event}
            stripCount={stripCount}
            guestCount={guestCount}
          />

          <div className="event-host-tabs">
            <button
              type="button"
              className={`event-host-tab ${activeTab === 'gallery' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('gallery')}
            >
              <span className="event-host-tab-icon" aria-hidden="true">📷</span>
              <span>Gallery</span>
              <span className="event-host-tab-count">{stripCount}</span>
            </button>
            {event.isActive && (
              <button
                type="button"
                className={`event-host-tab ${activeTab === 'share' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('share')}
              >
                <span className="event-host-tab-icon" aria-hidden="true">🔗</span>
                <span>Share</span>
              </button>
            )}
          </div>

          <div key={activeTab} className="page-fade">
          {activeTab === 'gallery' && (
            <EventHostGallery
              strips={strips}
              total={stripCount}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
              downloading={downloading}
              onDownloadAll={downloadAll}
              onRemove={removeStrip}
              removingId={removingId}
              closed={!event.isActive}
            />
          )}

          {event.isActive && activeTab === 'share' && (
            <EventHostShareQrPanel eventUrl={eventUrl} event={event} />
          )}
          </div>
        </div>
      )}
    </EventHostShell>
  );
}

export default EventHostDetailPage;