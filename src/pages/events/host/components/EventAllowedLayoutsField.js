import { STRIP_LAYOUTS, getLayoutById } from '../../../../data/stripLayouts';
import { DEFAULT_MAX_EVENT_UPLOADS } from '../../../../data/eventLimits';
import {
  allLayoutIds,
  layoutCapacitySummary,
  normalizeAllowedLayoutIds,
} from '../../../../utils/eventLayoutCapacity';

const MAX_CUSTOM = 2;

function EventAllowedLayoutsField({
  selectedIds,
  onChange,
  adminMaxEventUploads = DEFAULT_MAX_EVENT_UPLOADS,
}) {
  const ids = normalizeAllowedLayoutIds(selectedIds);
  const summary = layoutCapacitySummary(adminMaxEventUploads, ids);
  const mode = summary.isAllSelected ? 'all' : 'custom';
  const customIds = summary.isAllSelected ? [] : ids.slice(0, MAX_CUSTOM);

  const setMode = (nextMode) => {
    if (nextMode === 'all') {
      onChange(allLayoutIds());
      return;
    }
    onChange(customIds.length ? customIds : [STRIP_LAYOUTS[0].id]);
  };

  const setSlot = (index, rawValue) => {
    const value = Number(rawValue);
    const next = [...customIds];
    if (!value) {
      next.splice(index, 1);
    } else {
      next[index] = value;
    }
    const unique = [...new Set(next.filter(Boolean))].slice(0, MAX_CUSTOM);
    onChange(unique.length ? unique : [STRIP_LAYOUTS[0].id]);
  };

  return (
    <fieldset className="event-details-span event-allowed-layouts">
      <legend>Guest layouts</legend>

      <div className="event-layout-seg" role="radiogroup" aria-label="Guest layouts">
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'all'}
          className={`event-layout-seg-btn${mode === 'all' ? ' is-on' : ''}`}
          onClick={() => setMode('all')}
        >
          All layouts
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'custom'}
          className={`event-layout-seg-btn${mode === 'custom' ? ' is-on' : ''}`}
          onClick={() => setMode('custom')}
        >
          Up to 2
        </button>
      </div>

      {mode === 'custom' ? (
        <div className="event-layout-picks">
          {[0, 1].map((index) => {
            const value = customIds[index] || '';
            const layout = value ? getLayoutById(value) : null;
            const taken = new Set(customIds.filter((_, i) => i !== index));
            return (
              <div key={index} className="event-layout-pick">
                <div className={`event-layout-pick-badge${layout ? ' is-filled' : ''}`}>
                  {layout ? (
                    <>
                      <strong>{layout.photoCount}</strong>
                      <em>shot{layout.photoCount === 1 ? '' : 's'}</em>
                    </>
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <label className="event-layout-pick-field">
                  <span>{index === 0 ? 'First layout' : 'Second layout'}</span>
                  <select value={value} onChange={(e) => setSlot(index, e.target.value)}>
                    <option value="">{index === 0 ? 'Choose…' : 'Optional'}</option>
                    {STRIP_LAYOUTS.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={taken.has(item.id)}
                      >
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            );
          })}
        </div>
      ) : null}

      <p className="event-layout-limit" role="status">
        {summary.isAllSelected ? (
          <>
            Event can hold <strong>{summary.suggestedLimit}</strong> strips
            <span> · Polaroid-only ≈ {summary.polaroidOnlyLimit}</span>
          </>
        ) : (
          <>
            Event can hold <strong>{summary.suggestedLimit}</strong> strips
            <span> · based on {summary.heaviestName}</span>
          </>
        )}
      </p>
    </fieldset>
  );
}

export default EventAllowedLayoutsField;
