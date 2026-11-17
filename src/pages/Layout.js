import { useNavigate } from 'react-router-dom';
import { STRIP_LAYOUTS } from '../data/stripLayouts';
import LayoutPreview from '../components/LayoutPreview';
import './Layout.css';

function Layout() {
  const navigate = useNavigate();

  function handleSelectLayout(layoutId) {
    navigate(`/photobooth?layout=${layoutId}`);
  }

  return (
    <div className="layouts-page">
      <h2 className="layouts-heading">Layouts</h2>
      <p className="layouts-subheading">Choose a layout to use in your photobooth</p>

      <div className="layouts-grid">
        {STRIP_LAYOUTS.map((layout) => (
          <button
            key={layout.id}
            type="button"
            className="layout-option"
            onClick={() => handleSelectLayout(layout.id)}
          >
            <LayoutPreview layout={layout} />
            <span className="layout-label">
              {layout.label.map((line) => (
                <span key={line}>
                  {line}
                  <br />
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default Layout;
