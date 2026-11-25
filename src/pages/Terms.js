import { Link } from 'react-router-dom';
import './Legal.css';

function Terms() {
  return (
    <div className="legal-page">
      <p className="legal-kicker">Legal</p>
      <h1>Terms of Use</h1>
      <p className="legal-updated">Last updated: November 25, 2026</p>

      <section>
        <h2>1. Agreement</h2>
        <p>
          By using Photobooth.us (“Photobothus”, “we”, “us”), you agree to these Terms of Use.
          If you do not agree, do not use the service.
        </p>
      </section>

      <section>
        <h2>2. The service</h2>
        <p>
          Photobothus provides a browser-based photo booth, personal galleries, hosted events with
          guest booths, optional strip layouts and looks, Spotlight features, and related tools.
          Features may change as we improve the product.
        </p>
      </section>

      <section>
        <h2>3. Accounts</h2>
        <ul>
          <li>Customer accounts may sign in with Google.</li>
          <li>Admin accounts use email and password.</li>
          <li>You are responsible for activity under your account and for keeping sign-in details secure.</li>
          <li>You must provide accurate information and be old enough to use the service under your local law.</li>
        </ul>
      </section>

      <section>
        <h2>4. Hosted events and tickets</h2>
        <ul>
          <li>Creating a hosted event may require an event ticket.</li>
          <li>Tickets may be purchased (when checkout is enabled), granted by an admin, or earned through Spotlight rules we publish.</li>
          <li>Hosts set event details, schedules, layouts, and guest limits within the product settings.</li>
          <li>Guests join via the event link or QR; guests do not pay for booth use.</li>
          <li>We may refuse or limit events that abuse the platform, exceed storage, or break these Terms.</li>
        </ul>
      </section>

      <section>
        <h2>5. Your content</h2>
        <p>
          Photos and other content you or your guests upload remain yours (or your guests’).
          You grant us a limited license to store, process, encrypt, display, and deliver that
          content only as needed to operate Photobothus (including galleries, event downloads, and
          Spotlight when you opt in).
        </p>
        <p>
          You confirm you have the rights to upload content you submit, and that it does not
          violate law or others’ rights.
        </p>
      </section>

      <section>
        <h2>6. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Upload illegal, harmful, or abusive content</li>
          <li>Attempt to break, overload, or reverse-engineer the service</li>
          <li>Bypass guest or event limits, rate limits, or access controls</li>
          <li>Impersonate others or misuse event codes</li>
          <li>Use the service for spam, scraping, or unauthorized commercial redistribution of others’ photos</li>
        </ul>
      </section>

      <section>
        <h2>7. Payments</h2>
        <p>
          Paid ticket checkout, when available, is processed by our payment provider. Prices are
          shown in the product. Refunds, if any, follow the rules we state at purchase or that the
          payment provider requires. Unused tickets may remain on your account until used, unless
          we state otherwise.
        </p>
      </section>

      <section>
        <h2>8. Availability and changes</h2>
        <p>
          We aim for reliable uptime but do not guarantee uninterrupted service. We may modify,
          suspend, or discontinue features. Free tiers and storage limits may apply.
        </p>
      </section>

      <section>
        <h2>9. Disclaimers</h2>
        <p>
          The service is provided “as is” to the fullest extent allowed by law. We are not liable
          for indirect or consequential damages, lost photos beyond reasonable recovery efforts, or
          issues caused by your device, network, or third-party services (including Google and
          payment providers).
        </p>
      </section>

      <section>
        <h2>10. Termination</h2>
        <p>
          You may stop using Photobothus at any time. We may suspend or terminate access if you
          breach these Terms or misuse the service.
        </p>
      </section>

      <section>
        <h2>11. Contact</h2>
        <p>
          Questions about these Terms: message us on Instagram at{' '}
          <a href="https://ig.me/m/photobothus" target="_blank" rel="noopener noreferrer">
            @photobothus
          </a>
          .
        </p>
      </section>

      <div className="legal-links">
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/faq">FAQ</Link>
        <Link to="/">Home</Link>
      </div>
    </div>
  );
}

export default Terms;
