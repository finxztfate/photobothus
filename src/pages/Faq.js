import { useState } from 'react';
import { filterPresets } from '../data/photoboothData';
import './Faq.css';

const FILTER_NAMES = filterPresets.map((filter) => filter.name).join(', ');

const FAQS = [
  {
    question: 'Is Photobothus free to use?',
    answer: (
      <p>
        Yes. Open the booth, take your shots, customize your strip and download it — no
        account, no installs, no watermark.
      </p>
    ),
  },
  {
    question: 'Does it work on mobile?',
    answer: (
      <p>
        It does. The booth runs in any modern mobile browser, in portrait or landscape, and
        you can switch between your front and back camera.
      </p>
    ),
  },
  {
    question: 'Are my photos stored in your servers?',
    answer: (
      <p>
        No. Photos taken in the booth are processed right in your browser and stay on your
        device. They only leave it if you choose to save a strip to your Photobothus account or
        upload it to an event booth.
      </p>
    ),
  },
  {
    question: 'Can I actually print the photos?',
    answer: (
      <p>
        Absolutely. Downloads are high-resolution, print-ready files — take them to any print
        shop or print them at home.
      </p>
    ),
  },
  {
    question: 'Can I customize the photo strips?',
    answer: (
      <p>
        Yes. Pick from 2, 3, 4 or 6-frame layouts, then change the strip background and
        border color (including custom colors), add stickers and stamp the date before you
        download.
      </p>
    ),
  },
  {
    question: 'Why does my camera feed turn black?',
    answer: (
      <>
        <p>
          The feed stays black until you allow camera access — that part is intentional. If
          it's still black after allowing it, your system may be blocking the camera.
        </p>
        <ol className="faq-steps">
          <li>Check your browser's site settings and allow the camera for Photobothus.</li>
          <li>
            On Windows, go to Settings → Privacy &amp; Security → Camera and turn on camera
            access for apps and desktop apps.
          </li>
          <li>Close other apps that might be using the camera, then refresh the page.</li>
        </ol>
      </>
    ),
  },
  {
    question: 'Can I use this for events?',
    answer: (
      <p>
        Yes. Create an event from your account and share its link or code — guests open the
        booth on their own phones and every strip lands in your event gallery.
      </p>
    ),
  },
  {
    question: 'What filters are there?',
    answer: (
      <p>
        Every filter is vintage-inspired: {FILTER_NAMES}. Pick one before you shoot or
        upload, and it's baked right into your strip.
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
