const { parseLookJson } = require('./stripHelpers');

function lookJsonFromBody(body) {
  if (body?.look == null || body.look === '') return null;
  const parsed = parseLookJson(body.look);
  return parsed ? JSON.stringify(parsed) : null;
}

function applyLookToEvent(body) {
  return body?.applyToEvent === '1' || body?.applyToEvent === 'true';
}

function sharedLookJson(lookJson) {
  const parsed = parseLookJson(lookJson) || {};
  const shared = { ...parsed };
  delete shared.dateX;
  delete shared.dateY;
  return JSON.stringify(shared);
}

async function saveStripLook(pool, { eventId, stripId, lookJson, imageKey, applyToEvent }) {
  if (lookJson && applyToEvent) {
    await pool.query(
      'UPDATE strips SET look_json = ? WHERE event_id = ? AND id <> ?',
      [sharedLookJson(lookJson), eventId, stripId]
    );
  }
  await pool.query(
    'UPDATE strips SET image_url = COALESCE(?, image_url), look_json = COALESCE(?, look_json) WHERE id = ?',
    [imageKey, lookJson, stripId]
  );
}

module.exports = {
  lookJsonFromBody,
  applyLookToEvent,
  sharedLookJson,
  saveStripLook,
};
