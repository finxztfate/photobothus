import { useNavigate } from 'react-router-dom';
import SparkleDivider from '../components/SparkleDivider';
import { CONTACT_EMAIL } from '../data/siteContact';
import './About.css';

function About() {
  const navigate = useNavigate();

  return (
    <div className="about-page">
      <header className="about-banner">
        <h1 className="about-banner-title">
          About <span className="about-accent">Us</span>
        </h1>
      </header>

      <section className="about-intro">
        <div className="about-intro-text">
          <p>
            Our online photo booth is a fully customizable, browser-based tool you can use
            anytime and anywhere. It lets users snap instant photo booth-style photos, choose
            from over 100 frame colors, add digital stickers, and download high-resolution photo
            strips on any device - no installation or account needed.
          </p>
          <p>
            Built for speed, simplicity, and creative freedom, it delivers an all-in-one
            experience for making fun, shareable photos online. Users may also request a custom
            frame by emailing {CONTACT_EMAIL} or sending feedback below.
          </p>
          <button
            type="button"
            className="about-outline-btn about-feedback-btn"
            onClick={() => navigate('/feedback')}
          >
            Any Feedback?
          </button>
        </div>

        <div className="about-polaroids" aria-hidden="true">
          <div className="about-polaroid about-polaroid--back">
            <img src="/filmstrip/photo3.jpg" alt="" />
          </div>
          <div className="about-polaroid about-polaroid--front">
            <img src="/filmstrip/photo2.jpg" alt="" />
          </div>
        </div>
      </section>

      <section className="about-cta">
        <SparkleDivider className="about-divider" />

        <h2 className="about-cta-title">
          The Booth Is <span className="about-accent">Open</span>
        </h2>
        <p className="about-cta-text">no waiting. no tokens. no drama. just you and the camera.</p>
        <button
          type="button"
          className="about-outline-btn"
          onClick={() => navigate('/layouts')}
        >
          Snap Your First Strip
        </button>
      </section>
    </div>
  );
}

export default About;
