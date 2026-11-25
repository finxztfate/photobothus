import { useNavigate } from 'react-router-dom';
import { getPublicLayouts } from '../data/stripLayouts';
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

function Layout() {
  const navigate = useNavigate();
  const publicLayouts = getPublicLayouts();

  function handleSelectLayout(layoutId) {
    navigate(`/photobooth?layout=${layoutId}`);
  }

  return (
    <div className="layouts-page">
      <h2 className="layouts-heading">Layouts</h2>
      <p className="layouts-subheading">Choose a layout to use in your photobooth</p>

      <div className="layouts-grid layouts-mosaic">
        {publicLayouts.map((layout) => {
          const poses = layout.photoCount || layout.cells?.filter((cell) => cell.type === 'photo').length || 0;
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
    </div>
  );
}

export default Layout;
