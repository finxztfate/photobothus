import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import SparkleDivider from "../components/SparkleDivider";
import { SPOTLIGHT_ENABLED } from "../data/features";
import { apiRequest } from "../utils/api";
import "./Home.css";

const STEPS = [
  {
    number: "1",
    title: "OPEN THE BOOTH",
    body: "Hit the button. Camera opens. Pick a filter, choose your layout. The curtain's up.",
  },
  {
    number: "2",
    title: "TAKE YOUR SHOTS",
    body: "Countdown, flash, done. 2 to 6 frames captured automatically. Candid or posed — both go hard.",
  },
  {
    number: "3",
    title: "SAVE & POST!",
    body: SPOTLIGHT_ENABLED
      ? "Strip develops instantly. Save it. Print it. Post it. Or submit to the Spotlight wall."
      : "Strip develops instantly. Save it. Print it. Post it.",
  },
];

// Purely visual teaser — a taste, not the catalog. Show a handful and let
// "Browse All Layouts" carry the promise of more. The real picker (all
// layouts, selection state, filters) lives on /layouts.
const LAYOUTS = [
  { id: 'classic-strip', label: 'Classic Strip', frames: 4, shape: 'strip' },
  { id: '4x4-frame', label: '4x4 Frame', frames: 4, shape: 'grid' },
  { id: 'polaroid', label: 'Polaroid', frames: 1, shape: 'polaroid' },
  { id: 'wide-strip', label: 'Wide Strip', frames: 2, shape: 'wide' },
];

function LayoutThumb({ shape, frames }) {
  if (shape === "grid") {
    const cols = frames === 6 ? 3 : 2;
    return (
      <div
        className="layouts-thumb layouts-thumb--grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {Array.from({ length: frames }).map((_, i) => (
          <span key={i} className="layouts-frame" />
        ))}
      </div>
    );
  }
  if (shape === "wide") {
    return (
      <div className="layouts-thumb layouts-thumb--wide">
        {Array.from({ length: frames }).map((_, i) => (
          <span key={i} className="layouts-frame" />
        ))}
      </div>
    );
  }
  if (shape === "polaroid") {
    return (
      <div className="layouts-thumb layouts-thumb--polaroid">
        <span className="layouts-frame layouts-frame--polaroid" />
      </div>
    );
  }
  // strip (default)
  return (
    <div className="layouts-thumb layouts-thumb--strip">
      {Array.from({ length: frames }).map((_, i) => (
        <span key={i} className="layouts-frame" />
      ))}
    </div>
  );
}

function SpotlightCarousel({ items }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % items.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [items.length]);

  if (!items.length) return null;

  const prevIndex = (active - 1 + items.length) % items.length;
  const nextIndex = (active + 1) % items.length;

  return (
    <div className="spotlight-carousel">
      <div className="spotlight-cards">
        <div
          className="spotlight-card spotlight-card--prev"
          style={{ backgroundImage: `url(${items[prevIndex].image})` }}
        />
        <div
          className="spotlight-card spotlight-card--active"
          style={{ backgroundImage: `url(${items[active].image})` }}
        />
        <div
          className="spotlight-card spotlight-card--next"
          style={{ backgroundImage: `url(${items[nextIndex].image})` }}
        />
      </div>
      <p className="spotlight-quote">"{items[active].quote}"</p>
      <p className="spotlight-user">{items[active].user}</p>
    </div>
  );
}

function Home() {
  const navigate = useNavigate();
  const [spotlight, setSpotlight] = useState([]);

  useEffect(() => {
    if (!SPOTLIGHT_ENABLED) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest("/api/public/spotlight");
        if (!cancelled) setSpotlight(data.home || []);
      } catch {
        if (!cancelled) setSpotlight([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const spotlightItems = spotlight.map((item) => ({
    image: item.imageUrl,
    quote: item.caption || item.title || "Featured strip",
    user: item.credit,
  }));

  return (
    <div className="home-page">
      <main className="hero">
        <p className="hero-eyebrow">INSTANT PHOTO BOOTH</p>
        <h1 className="hero-title">PHOTOBOTHUS</h1>
        <p className="hero-subtitle">Capture Moments, Create Memories.</p>
        <button className="cta-btn" onClick={() => navigate("/layouts")}>
          Start Photobooth
        </button>
      </main>

      {/* Filmstrip section sample images (Duplicated to create a continuous scrolling effect) */}

      <div className="filmstrip">
        <div className="filmstrip-track">
          <img src="/filmstrip/photo1.jpg" alt="Photobooth sample 1" />
          <img src="/filmstrip/photo2.jpg" alt="Photobooth sample 2" />
          <img src="/filmstrip/photo3.jpg" alt="Photobooth sample 3" />
          <img src="/filmstrip/photo4.jpg" alt="Photobooth sample 4" />
          <img src="/filmstrip/photo5.jpg" alt="Photobooth sample 5" />

          <img src="/filmstrip/photo1.jpg" alt="Photobooth sample 1" />
          <img src="/filmstrip/photo2.jpg" alt="Photobooth sample 2" />
          <img src="/filmstrip/photo3.jpg" alt="Photobooth sample 3" />
          <img src="/filmstrip/photo4.jpg" alt="Photobooth sample 4" />
          <img src="/filmstrip/photo5.jpg" alt="Photobooth sample 5" />
        </div>
      </div>

      <SparkleDivider />

      <section className="features">
        <div className="features-inner">
          <div className="feature-card">
            <img src="/icons/camera.svg" alt="" className="feature-icon" />
            <h3>Live Camera</h3>
            <p>
              Opens straight in your browser. No downloads. Front or back
              camera, whatever angle slaps.
            </p>
          </div>

          <div className="feature-card">
            <img src="/icons/strips.svg" alt="" className="feature-icon" />
            <h3>Photo Strips</h3>
            <p>
              Choose your layout. 2,3,4, or 6 frames. Looks exactly like the
              real thing from the mall.
            </p>
          </div>

          <div className="feature-card">
            <img src="/icons/filters.svg" alt="" className="feature-icon" />
            <h3>Camera Filters</h3>
            <p>
              Handcrafted presets - disposable warmth, grainy lo-fi, faded 90's
              Kodak, b&w newspaper.
            </p>
          </div>

          <div className="feature-card">
            <img src="/icons/download.svg" alt="" className="feature-icon" />
            <h3>Instant Downloads</h3>
            <p>
              Print-ready file, right to your camera roll. Take it to a print
              shop or post it unfiltered.
            </p>
          </div>
        </div>
      </section>

      <section className="how-it-works">
        <h2 className="hiw-heading">How It Works</h2>
        <p className="hiw-subheading">Three Steps, One Strip</p>
        <div className="hiw-cards">
          {STEPS.map((step) => (
            <div className="hiw-card" key={step.number}>
              <div className="hiw-card-header">
                <span className="hiw-number">{step.number}</span>
                <h3 className="hiw-card-title">{step.title}</h3>
              </div>
              <p className="hiw-card-body">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <SparkleDivider />

      <section className="layouts-preview">
        <h2 className="layouts-heading">Layouts</h2>
        <p className="layouts-subheading">Strips, Grids &amp; One-Offs</p>
        <div className="layouts-cards">
          {LAYOUTS.map((layout) => (
            <div className="layouts-card" key={layout.id}>
              <LayoutThumb shape={layout.shape} frames={layout.frames} />
              <span className="layouts-card-label">{layout.label}</span>
            </div>
          ))}
        </div>
        <button
          className="cta-btn layouts-cta"
          onClick={() => navigate("/layouts")}
        >
          Browse All Layouts
        </button>
      </section>

      {SPOTLIGHT_ENABLED && spotlightItems.length > 0 && (
      <>
      <SparkleDivider />

      <section className="community-spotlight">
        <h2 className="cs-heading">
          Community <span className="cs-heading-accent">Spotlight</span>
        </h2>
        <p className="cs-subheading">
          Staff picks on the home carousel. Community Photo of the Week lives on Spotlight.
        </p>

        <SpotlightCarousel items={spotlightItems} />

        <button className="cs-view-more" onClick={() => navigate("/spotlight")}>
          View More Spotlight
        </button>
      </section>
      </>
      )}
    </div>
  );
}

export default Home;