function EventHostGallery({
  strips,
  total = strips.length,
  loadingMore = false,
  onLoadMore,
  downloading,
  onDownloadAll,
  onRemove,
  removingId,
  closed = false,
}) {
  const hasMore = strips.length < total;

  return (
    <section className="event-host-gallery">
      <div className="event-host-gallery-bar">
        <div className="event-host-gallery-titles">
          <h2>Live Event Gallery</h2>
          <span>
            showing {strips.length} of {total} photo{total === 1 ? '' : 's'}
          </span>
        </div>
        <button
          type="button"
          className="event-host-download"
          onClick={onDownloadAll}
          disabled={!total || downloading}
        >
          {downloading ? 'Preparing ZIP…' : 'Download All'}
        </button>
      </div>

      {strips.length === 0 ? (
        <div className="event-host-gallery-empty">
          {closed ? (
            <>
              <p>Photos from this event were deleted when it closed.</p>
              <p>They are no longer stored.</p>
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
              <img src={strip.imageUrl} alt={strip.title || `Guest photo ${index + 1}`} />
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
