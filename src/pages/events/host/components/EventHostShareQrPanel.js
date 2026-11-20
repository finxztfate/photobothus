import { useRef } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { DEFAULT_MAX_GUEST_UPLOADS } from '../../../../data/eventLimits';

const QR_PRINT_SIZE = 1024;

function qrFilename(event) {
  const code = String(event?.code || 'event').replace(/[^\w.-]+/g, '_');
  return `photobothus-${code}-qr.png`;
}

function EventHostShareQrPanel({ eventUrl, event }) {
  const printCanvasRef = useRef(null);

  if (!eventUrl) return null;

  const downloadQr = () => {
    const canvas = printCanvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = qrFilename(event);
      link.click();
      URL.revokeObjectURL(href);
    }, 'image/png');
  };

  return (
    <section className="event-host-share">
      <div className="event-host-qr">
        <QRCodeSVG value={eventUrl} size={168} includeMargin bgColor="#ffffff" fgColor="#2a1810" />
        <QRCodeCanvas
          ref={printCanvasRef}
          className="event-host-qr-print"
          value={eventUrl}
          size={QR_PRINT_SIZE}
          includeMargin
          bgColor="#ffffff"
          fgColor="#2a1810"
          aria-hidden="true"
        />
        {event?.code ? <p className="event-host-qr-code">{event.code}</p> : null}
        <button type="button" className="event-host-btn event-host-qr-download" onClick={downloadQr}>
          Download QR
        </button>
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
