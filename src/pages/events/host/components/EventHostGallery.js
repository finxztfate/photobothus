import { Link } from 'react-router-dom';

function EventHostGallery({
  eventId,
  strips,
  total = strips.length,
  loadingMore = false,
  onLoadMore,
  downloading,
  onDownloadAll,
  onRemove,
  removingId,
  locked = false,
}) {
  const hasMore = !locked && strips.length < total;

  return (
    <section className="event-host-gallery">
      <div className="event-host-gallery-bar">
        <div className="event-host-gallery-titles">
          <h2>{locked ? 'Guest photos' : 'Event gallery'}</h2>
          <span>
            {locked
              ? `${total} photo${total === 1 ? '' : 's'} collected · hidden until the event ends`
              : `showing ${strips.length} of ${total} · Tap a strip to customize all photos`}
          </span>
        </div>
        <button
          type="button"
          className={`event-host-btn${locked || !total ? '' : ' primary'}`}
          onClick={onDownloadAll}
          disabled={locked || !total || downloading}
        >
          {downloading ? 'Preparing ZIP…' : 'Download all'}
        </button>
      </div>

      {locked ? (
        <div className="event-host-gallery-empty">
          <p>Guest photos stay hidden while the event is live.</p>
          <p>End the event to review, download, and share them.</p>
        </div>
      ) : strips.length === 0 ? (
        <div className="event-host-gallery-empty">
          {total > 0 ? (
            <>
              <p>No guest photos to show yet.</p>
            </>
          ) : (
            <>
              <p>No guest photos yet.</p>
              <p>Share the QR or guest link to start collecting uploads.</p>
            </>
          )}
        </div>
      ) : (
        <div className="event-host-gallery-grid">
          {strips.map((strip, index) => (
            <article key={strip.id} className="event-host-gallery-item">
              <span className="event-host-gallery-label">
                {strip.guestKey ? 'Guest' : 'User'}
              </span>
              {onRemove && (
                <button
                  type="button"
                  className="event-host-gallery-remove"
                  onClick={() => onRemove(strip)}
                  disabled={removingId === strip.id}
                  aria-label={`Remove photo ${index + 1} from the gallery`}
                >
                  {removingId === strip.id ? 'Removing…' : 'Remove'}
                </button>
              )}
              {eventId ? (
                <Link
                  className="event-host-gallery-open"
                  to={`/events/${eventId}/strips/${strip.id}/edit`}
                  aria-label={`Customize strip ${index + 1}`}
                >
                  <img src={strip.imageUrl} alt={strip.title || `Guest photo ${index + 1}`} />
                </Link>
              ) : (
                <img src={strip.imageUrl} alt={strip.title || `Guest photo ${index + 1}`} />
              )}
            </article>
          ))}
        </div>
      )}

      {hasMore && onLoadMore && strips.length > 0 && (
        <div className="event-host-gallery-more">
          <button type="button" className="event-host-btn" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more photos'}
          </button>
        </div>
      )}
    </section>
  );
}

export default EventHostGallery;
