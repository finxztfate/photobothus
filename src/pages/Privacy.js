import { Link } from 'react-router-dom';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '../data/siteContact';
import './Legal.css';

function Privacy() {
  return (
    <div className="legal-page">
      <p className="legal-kicker">Legal</p>
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Last updated: November 25, 2026</p>

      <section>
        <h2>1. Overview</h2>
        <p>
          This Privacy Policy explains how Photobooth.us (“Photobothus”, “we”, “us”) collects and
          uses information when you use our website and photo booth tools.
        </p>
      </section>

      <section>
        <h2>2. Information we collect</h2>
        <ul>
          <li>
            <strong>Account data</strong> — email, display name, and avatar from Google sign-in;
            admin accounts use email and a password hash.
          </li>
          <li>
            <strong>Photos</strong> — images you or event guests capture or upload, including strip
            previews and cell photos for layouts.
          </li>
          <li>
            <strong>Event data</strong> — event titles, schedules, locations, welcome messages,
            layout choices, guest keys, and related settings.
          </li>
          <li>
            <strong>Usage data</strong> — basic technical logs needed to run and secure the service
            (for example, IP-based rate limiting).
          </li>
          <li>
            <strong>Payment records</strong> — when ticket checkout is enabled, payment status and
            related metadata from our payment provider (we do not store full card numbers).
          </li>
        </ul>
      </section>

      <section>
        <h2>3. How we use information</h2>
        <ul>
          <li>Provide the booth, galleries, hosted events, and Spotlight features</li>
          <li>Authenticate users and protect accounts</li>
          <li>Encrypt and store photos, and deliver them to hosts/guests as designed</li>
          <li>Enforce limits, prevent abuse, and keep the service available</li>
          <li>Process ticket purchases and fulfill ticket balances when checkout is enabled</li>
          <li>Improve reliability and support</li>
        </ul>
      </section>

      <section>
        <h2>4. Cookies and local storage</h2>
        <p>
          We use cookies and similar browser storage to keep you signed in, remember preferences
          (such as theme or cookie consent), and support guest booth sessions. See our cookie
          notice on first visit. You can clear site data in your browser at any time.
        </p>
      </section>

      <section>
        <h2>5. Photos and security</h2>
        <p>
          Uploaded photos are stored on our hosting infrastructure. Where configured, photo files
          are encrypted at rest. Access to event photos follows product rules (for example, guest
          keys and host unlock after an event ends). Keep your account and event links private.
        </p>
      </section>

      <section>
        <h2>6. Sharing</h2>
        <p>We do not sell your personal information. We may share data with:</p>
        <ul>
          <li>Service providers that host the app, database, storage, or payments</li>
          <li>Google, for customer sign-in</li>
          <li>Authorities when required by law</li>
        </ul>
        <p>
          Hosts and guests may see photos and event content according to how the event and gallery
          features work. Spotlight submissions are reviewed before they appear publicly on the site.
        </p>
      </section>

      <section>
        <h2>7. Retention</h2>
        <p>
          We keep account and event data while your account or events remain active. Photos are
          removed when you delete them, delete an event, or when we remove content as part of
          abuse handling or storage limits. Backups may retain data for a limited time.
        </p>
      </section>

      <section>
        <h2>8. Your choices</h2>
        <ul>
          <li>Update or delete personal gallery photos from your account tools</li>
          <li>Hosts can end events and delete events/photos they own</li>
          <li>Opt out of Spotlight by turning off opt-in where available</li>
          <li>Contact us to ask about access or deletion of account data</li>
        </ul>
      </section>

      <section>
        <h2>9. Children</h2>
        <p>
          Photobothus is not directed at children under 13 (or the minimum age required in your
          region). Do not use the service if you are under that age.
        </p>
      </section>

      <section>
        <h2>10. Changes</h2>
        <p>
          We may update this Policy. The “Last updated” date above will change when we do. Continued
          use after an update means you accept the revised Policy.
        </p>
      </section>

      <section>
        <h2>11. Contact</h2>
        <p>
          Privacy questions:{' '}
          <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>
          .
        </p>
      </section>

      <div className="legal-links">
        <Link to="/terms">Terms of Use</Link>
        <Link to="/faq">FAQ</Link>
      </div>
    </div>
  );
}

export default Privacy;
