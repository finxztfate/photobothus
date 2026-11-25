import { useState } from 'react';
import { Link } from 'react-router-dom';
import { filterPresets } from '../data/photoboothData';
import './Faq.css';

const FILTER_NAMES = filterPresets.map((filter) => filter.name).join(', ');

const FAQS = [
  {
    question: 'Is Photobothus free to use?',
    answer: (
      <p>
        The personal booth is free — open it, shoot, customize, and download with no account and
        no watermark. Hosted events use an event ticket (buy when checkout is open, or earn via
        Spotlight). Guests never pay to use an event booth.
      </p>
    ),
  },
  {
    question: 'Does it work on mobile?',
    answer: (
      <p>
        Yes. It runs in any modern mobile browser, portrait or landscape, and you can switch
        between front and back camera.
      </p>
    ),
  },
  {
    question: 'Are my photos stored on your servers?',
    answer: (
      <p>
        Booth shots stay in your browser unless you save a strip to your account gallery or upload
        to a hosted event. Saved and event photos are stored securely (encrypted when configured).
        See our <Link to="/privacy">Privacy Policy</Link> for details.
      </p>
    ),
  },
  {
    question: 'Can I print the photos?',
    answer: (
      <p>
        Yes. Downloads are high-resolution, print-ready files — print at home or any print shop.
      </p>
    ),
  },
  {
    question: 'Can I customize the photo strips?',
    answer: (
      <p>
        Yes. Choose a layout, change background and border colors (including custom colors), add
        stickers, and stamp the date before you download. Event hosts can also set a strip look
        and which layouts guests may use.
      </p>
    ),
  },
  {
    question: 'How do hosted events work?',
    answer: (
      <>
        <p>
          Sign in, spend one event ticket, create the event, then share the link or QR. Guests open
          the booth on their phones; strips land in your event gallery. You pick the schedule,
          welcome message, layouts, and strip look.
        </p>
        <p>
          Each guest can upload up to 2 strips. Each event holds up to 30 strips total. Choosing
          only some layouts (instead of all) can raise how many strips fit the same storage budget.
        </p>
      </>
    ),
  },
  {
    question: 'What are event tickets?',
    answer: (
      <p>
        One ticket = one hosted event. When checkout is available, you can buy packs on the{' '}
        <Link to="/tickets">Tickets</Link> page. You can also earn tickets through Spotlight Photo
        of the Week wins (rules are listed there). Tickets sit on your account until you use them.
      </p>
    ),
  },
  {
    question: 'What is Spotlight?',
    answer: (
      <p>
        Spotlight is our community showcase. Submit a personal gallery strip for review; after
        approval it competes for Photo of the Week — wins can earn event tickets. Browse entries on
        the <Link to="/spotlight">Spotlight</Link> page when it is enabled.
      </p>
    ),
  },
  {
    question: 'Why does my camera feed turn black?',
    answer: (
      <>
        <p>
          The feed stays black until you allow camera access. If it is still black after allowing
          it, your system may be blocking the camera.
        </p>
        <ol className="faq-steps">
          <li>Check your browser site settings and allow the camera for Photobothus.</li>
          <li>
            On Windows, go to Settings → Privacy &amp; Security → Camera and turn on camera access
            for apps and desktop apps.
          </li>
          <li>Close other apps that might be using the camera, then refresh the page.</li>
        </ol>
      </>
    ),
  },
  {
    question: 'What filters are there?',
    answer: (
      <p>
        Every filter is vintage-inspired: {FILTER_NAMES}. Pick one before you shoot or upload, and
        it is baked into your strip.
      </p>
    ),
  },
  {
    question: 'Do you use cookies?',
    answer: (
      <p>
        Yes — mainly to keep you signed in and remember preferences like theme and cookie consent.
        Details are in our <Link to="/privacy">Privacy Policy</Link> and{' '}
        <Link to="/terms">Terms of Use</Link>.
      </p>
    ),
  },
];

function ApertureIcon() {
  return (
    <svg className="faq-title-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" className="faq-title-icon-disc" />
      <g className="faq-title-icon-blades">
        <line x1="14.31" y1="8" x2="20.05" y2="17.94" />
        <line x1="9.69" y1="8" x2="21.17" y2="8" />
        <line x1="7.38" y1="12" x2="13.12" y2="2.06" />
        <line x1="9.69" y1="16" x2="3.95" y2="6.06" />
        <line x1="14.31" y1="16" x2="2.83" y2="16" />
        <line x1="16.62" y1="12" x2="10.88" y2="21.94" />
      </g>
    </svg>
  );
}

function Faq() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (index) => {
    setOpenIndex((current) => (current === index ? null : index));
  };

  return (
    <div className="faq-page">
      <main className="faq-container">
        <header className="faq-hero">
          <h1 className="faq-title">
            <ApertureIcon />
            Got Questions?
          </h1>
          <p className="faq-subtitle">Frequently Asked :</p>
        </header>

        <section className="faq-list">
          {FAQS.map((item, index) => {
            const isOpen = openIndex === index;
            const panelId = `faq-panel-${index}`;
            const buttonId = `faq-button-${index}`;

            return (
              <div className={`faq-item${isOpen ? ' is-open' : ''}`} key={item.question}>
                <button
                  type="button"
                  id={buttonId}
                  className="faq-question"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(index)}
                >
                  <span>{item.question}</span>
                  <svg className="faq-caret" viewBox="0 0 12 8" aria-hidden="true">
                    <path d="M0 0h12L6 8z" />
                  </svg>
                </button>
                <div
                  id={panelId}
                  className="faq-answer"
                  role="region"
                  aria-labelledby={buttonId}
                >
                  <div className="faq-answer-inner">{item.answer}</div>
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}

export default Faq;
