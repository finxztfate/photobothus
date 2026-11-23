const TEXT_FIELDS = [
  ['quote', 'Quote', 500],
  ['location', 'Location', 120],
  ['layout', 'Layout', 120],
  ['device', 'Device', 80],
];

const SOCIAL_NETWORKS = ['instagram', 'facebook'];

function readSocial(source) {
  const network = String(source.socialNetwork || '').trim().toLowerCase();
  if (!SOCIAL_NETWORKS.includes(network)) {
    return { error: 'Choose Instagram or Facebook' };
  }
  const raw = String(source.social ?? '').trim();
  if (!raw) return { error: 'Social is required' };

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { error: 'Enter a username or profile link' };
      }
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      if (network === 'instagram' && host !== 'instagram.com') {
        return { error: 'Use an Instagram profile link or @handle' };
      }
      if (network === 'facebook' && host !== 'facebook.com' && host !== 'fb.com') {
        return { error: 'Use a Facebook profile link or username' };
      }
      return { socialNetwork: network, social: url.toString().slice(0, 200) };
    } catch {
      return { error: 'Enter a username or profile link' };
    }
  }

  const handle = raw.replace(/^@/, '').replace(/^\/+/, '');
  if (!/^[a-zA-Z0-9._]{1,50}$/.test(handle)) {
    return { error: 'Enter a username or profile link' };
  }
  return { socialNetwork: network, social: handle };
}

function readSpotlightDetails(input) {
  const source = input && typeof input === 'object' ? input : {};
  const details = {};
  for (const [key, label, max] of TEXT_FIELDS) {
    const value = String(source[key] ?? '').trim();
    if (!value) return { error: `${label} is required` };
    details[key] = value.slice(0, max);
  }
  const social = readSocial(source);
  if (social.error) return social;
  details.socialNetwork = social.socialNetwork;
  details.social = social.social;
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
