import { getLayoutById } from '../data/stripLayouts';

function LayoutPreview({
  layout: layoutProp,
  photos = [],
  className = '',
}) {
  const layout = typeof layoutProp === 'object' ? layoutProp : getLayoutById(layoutProp);

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

        const photo = photos[cell.photoIndex ?? photoCursor];
        if (cell.photoIndex == null) photoCursor += 1;

        return (
          <span
            key={cell.area}
            className="layout-cell layout-cell--photo"
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
