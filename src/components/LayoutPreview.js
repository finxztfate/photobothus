import { getLayoutById } from '../data/stripLayouts';

function LayoutPreview({
  layout: layoutProp,
  photos = [],
  className = '',
  onPhotoClick,
  activePhotoIndex = null,
  emptyLabel = false,
}) {
  const layout = typeof layoutProp === 'object' ? layoutProp : getLayoutById(layoutProp);
  const interactive = typeof onPhotoClick === 'function';

  let photoCursor = 0;

  return (
    <div
      className={`layout-preview ${className}`.trim()}
      style={{
        aspectRatio: layout.aspect,
        gridTemplateAreas: layout.areas,
        gridTemplateRows: layout.rows,
        gridTemplateColumns: layout.columns,
      }}
      aria-label={interactive ? 'Captured photos' : undefined}
    >
      {layout.cells.map((cell) => {
        if (cell.type === 'dark') {
          return (
            <span
              key={cell.area}
              className="layout-cell layout-cell--dark"
              style={{ gridArea: cell.area }}
            />
          );
        }

        const photoIndex = cell.photoIndex ?? photoCursor;
        if (cell.photoIndex == null) photoCursor += 1;
        const photo = photos[photoIndex];
        const isCurrent = activePhotoIndex === photoIndex;
        const classNameCell = [
          'layout-cell',
          'layout-cell--photo',
          photo ? '' : 'is-empty',
          isCurrent ? 'is-current' : '',
        ].filter(Boolean).join(' ');

        if (interactive) {
          return (
            <button
              key={cell.area}
              type="button"
              className={classNameCell}
              style={{ gridArea: cell.area }}
              disabled={!photo}
              onClick={() => onPhotoClick(photoIndex)}
              aria-label={photo ? `Retake shot ${photoIndex + 1}` : `Shot ${photoIndex + 1} empty`}
            >
              {photo?.src ? (
                <img src={photo.src} alt="" className="layout-cell-img" />
              ) : emptyLabel ? (
                <span className="layout-cell-index">{photoIndex + 1}</span>
              ) : null}
            </button>
          );
        }

        return (
          <span
            key={cell.area}
            className={classNameCell}
            style={{ gridArea: cell.area }}
          >
            {photo?.src ? (
              <img src={photo.src} alt="" className="layout-cell-img" />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

export default LayoutPreview;
