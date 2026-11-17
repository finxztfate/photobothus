const jwt = require('jsonwebtoken');
const { getImageAccessTtlHours } = require('./settings');

const SECRET = process.env.JWT_SECRET || 'dev-secret';

async function signStripImageAccess(stripId) {
  let hours = 24;
  try {
    hours = await getImageAccessTtlHours();
  } catch {
    hours = Number(process.env.IMAGE_ACCESS_TTL_HOURS) || 24;
  }

  return jwt.sign({ stripId: Number(stripId), purpose: 'strip-image' }, SECRET, {
    expiresIn: `${hours}h`,
  });
}

function verifyStripImageAccess(token, stripId) {
  if (!token) return false;
  try {
    const payload = jwt.verify(token, SECRET);
    return (
      payload.purpose === 'strip-image' &&
      Number(payload.stripId) === Number(stripId)
    );
  } catch {
    return false;
  }
}

function stripImageUrl(stripId, accessToken) {
  return `/api/strips/${stripId}/image?access=${encodeURIComponent(accessToken)}`;
}

module.exports = {
  signStripImageAccess,
  verifyStripImageAccess,
  stripImageUrl,
};
