const TEXT_FIELDS = [
  ['quote', 'Quote', 500],
  ['location', 'Location', 120],
  ['filter', 'Filter', 120],
  ['layout', 'Layout', 120],
  ['camera', 'Camera', 80],
  ['device', 'Device', 80],
  ['edition', 'Edition', 80],
];

function readSpotlightDetails(input) {
  const source = input && typeof input === 'object' ? input : {};
  const details = {};
  for (const [key, label, max] of TEXT_FIELDS) {
    const value = String(source[key] ?? '').trim();
    if (!value) return { error: `${label} is required` };
    details[key] = value.slice(0, max);
  }
  const frames = Number(source.frames);
  if (!Number.isInteger(frames) || frames < 1 || frames > 12) {
    return { error: 'Frames must be a number from 1 to 12' };
  }
  details.frames = frames;
  return { details };
}

function parseSpotlightDetails(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

module.exports = { readSpotlightDetails, parseSpotlightDetails };
