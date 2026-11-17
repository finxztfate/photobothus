import { QRCodeSVG } from 'qrcode.react';

function EventHostShareQrPanel({ eventUrl, event }) {
  if (!eventUrl) return null;

  return (
    <section className="event-host-share">
      <div className="event-host-share-content">
        <h2>Share Event</h2>
        <p>Guests scan the QR code or use the link below to open the booth and upload photos.</p>
        <code className="event-host-share-url">{eventUrl}</code>
        <div className="event-host-share-actions">
          <button
            type="button"
            className="event-host-btn primary"
            onClick={() => navigator.clipboard.writeText(eventUrl)}
          >
            Copy Link
          </button>
        </div>
      </div>
      <div className="event-host-qr">
        <QRCodeSVG value={eventUrl} size={180} />
        {event?.code && (
          <p style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--eh-muted)', textAlign: 'center' }}>
            Event code: <strong>{event.code}</strong>
          </p>
        )}
      </div>
    </section>
  );
}

export default EventHostShareQrPanel;