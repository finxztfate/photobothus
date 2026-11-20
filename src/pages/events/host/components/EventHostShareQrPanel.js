import { QRCodeSVG } from 'qrcode.react';
import { DEFAULT_MAX_GUEST_UPLOADS } from '../../../../data/eventLimits';

function EventHostShareQrPanel({ eventUrl, event }) {
  if (!eventUrl) return null;

  return (
    <section className="event-host-share">
      <div className="event-host-qr">
        <QRCodeSVG value={eventUrl} size={168} />
        {event?.code ? <p className="event-host-qr-code">{event.code}</p> : null}
      </div>
      <div className="event-host-share-content">
        <p className="event-host-kicker">Guest booth</p>
        <h2>Share this event</h2>
        <p>
          Guests scan the QR or open the link to use the booth.
          Each guest can upload {DEFAULT_MAX_GUEST_UPLOADS} photos.
        </p>
        <div className="event-host-share-row">
          <code className="event-host-share-url">{eventUrl}</code>
          <button
            type="button"
            className="event-host-btn primary"
            onClick={() => navigator.clipboard.writeText(eventUrl)}
          >
            Copy
          </button>
        </div>
      </div>
    </section>
  );
}

export default EventHostShareQrPanel;