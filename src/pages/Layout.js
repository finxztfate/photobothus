import { Link, useNavigate } from 'react-router-dom';
import { getEventExclusiveLayouts, getPublicLayouts } from '../data/stripLayouts';
import LayoutPreview from '../components/LayoutPreview';
import './Layout.css';

const SAMPLE_PHOTOS = [
  { src: '/filmstrip/photo1.jpg' },
  { src: '/filmstrip/photo2.jpg' },
  { src: '/filmstrip/photo3.jpg' },
  { src: '/filmstrip/photo1.jpg' },
  { src: '/filmstrip/photo2.jpg' },
  { src: '/filmstrip/photo3.jpg' },
];

function layoutPoses(layout) {
  return layout.photoCount || layout.cells?.filter((cell) => cell.type === 'photo').length || 0;
}

function Layout() {
  const navigate = useNavigate();
  const publicLayouts = getPublicLayouts();
  const exclusiveLayouts = getEventExclusiveLayouts();

  function handleSelectLayout(layoutId) {
    navigate(`/photobooth?layout=${layoutId}`);
  }

  return (
    <div className="layouts-page">
      <h2 className="layouts-heading">Layouts</h2>
      <p className="layouts-subheading">Choose a layout to use in your photobooth</p>

      <div className="layouts-grid layouts-mosaic">
        {publicLayouts.map((layout) => {
          const poses = layoutPoses(layout);
          return (
            <button
              key={layout.id}
              type="button"
              className="layout-option"
              onClick={() => handleSelectLayout(layout.id)}
            >
              <LayoutPreview layout={layout} photos={SAMPLE_PHOTOS.slice(0, Math.max(poses, 1))} />
              <span className="layout-label">
                <span className="layout-label-name">{layout.name}</span>
                <span className="layout-label-meta">
                  {poses} pose{poses === 1 ? '' : 's'}
                </span>
                <span className="layout-label-cta">Start booth</span>
              </span>
            </button>
          );
        })}
      </div>

      {exclusiveLayouts.length > 0 ? (
        <section className="layouts-exclusive" aria-labelledby="layouts-exclusive-title">
          <div className="layouts-exclusive-head">
            <p className="layouts-exclusive-kicker">Hosted events</p>
            <h3 className="layouts-exclusive-title" id="layouts-exclusive-title">
              Exclusive for Event Handling
            </h3>
            <p className="layouts-exclusive-text">
              These layouts stay off the public booth. Open them when you host an event.
            </p>
          </div>
          <div className="layouts-grid layouts-mosaic layouts-mosaic--exclusive">
            {exclusiveLayouts.map((layout) => {
              const poses = layoutPoses(layout);
              return (
                <div key={layout.id} className="layout-option layout-option--exclusive">
                  <span className="layout-exclusive-badge">Event only</span>
                  <LayoutPreview layout={layout} photos={SAMPLE_PHOTOS.slice(0, Math.max(poses, 1))} />
                  <span className="layout-label">
                    <span className="layout-label-name">{layout.name}</span>
                    <span className="layout-label-meta">
                      {poses} pose{poses === 1 ? '' : 's'}
                    </span>
                    <Link className="layout-label-cta layout-label-cta--link" to="/events">
                      Use in an event
                    </Link>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default Layout;
