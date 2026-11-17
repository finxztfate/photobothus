const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('../test-support/testApp');

let app;
let owner;
let other;
let admin;

before(async () => {
  app = await startTestApp();
  owner = app.db.addUser({ email: 'owner@x.com', display_name: 'Avery' });
  other = app.db.addUser({ email: 'other@x.com', display_name: 'Blake' });
  admin = app.db.addUser({ email: 'admin@x.com', role: 'admin' });
});

after(() => app.stop());

const DETAILS = {
  quote: 'Late night after the show',
  location: 'Manila, PH',
  filter: 'Kodak - Original',
  layout: 'Classic Strip',
  frames: 4,
  camera: 'Front',
  device: 'Phone',
  edition: 'No.1',
};

function allow(stripId, as = owner) {
  return app.api('PATCH', `/api/strips/${stripId}`, {
    as,
    body: { spotlightOptIn: true, details: DETAILS },
  });
}

test('a signed-in customer can allow their own personal strip on Spotlight', async () => {
  const strip = app.db.addStrip({ user_id: owner.id, title: 'Mine' });
  const denied = await app.api('PATCH', `/api/strips/${strip.id}`, { body: { spotlightOptIn: true } });
  assert.equal(denied.status, 401);

  const missing = await app.api('PATCH', `/api/strips/${strip.id}`, {
    as: owner,
    body: { spotlightOptIn: true },
  });
  assert.equal(missing.status, 400);

  const allowed = await allow(strip.id);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.spotlightOptIn, true);
  assert.equal(allowed.body.spotlightDetails.quote, DETAILS.quote);

  const listed = await app.api('GET', '/api/strips', { as: owner });
  const saved = listed.body.strips.find((item) => item.id === strip.id);
  assert.equal(saved.spotlightOptIn, true);
  assert.equal(saved.spotlightDetails.location, DETAILS.location);
});

test('another customer cannot opt in a strip, and an event strip cannot be opted in', async () => {
  const personal = app.db.addStrip({ user_id: owner.id, title: 'Theirs' });
  const event = app.db.addEvent({ owner_id: owner.id, name: 'Party' });
  const eventStrip = app.db.addStrip({ event_id: event.id, guest_key: 'guest-1', title: 'Guest' });

  assert.equal(
    (await app.api('PATCH', `/api/strips/${personal.id}`, { as: other, body: { spotlightOptIn: true } })).status,
    404
  );
  assert.equal(
    (await app.api('PATCH', `/api/strips/${eventStrip.id}`, { as: owner, body: { spotlightOptIn: true } })).status,
    404
  );
  assert.equal(personal.spotlight_opt_in, 0);
  assert.equal(eventStrip.spotlight_opt_in, 0);
});

test('an admin can feature only an opted-in personal strip, and the week pick stays for 7 days', async () => {
  const first = app.db.addStrip({ user_id: owner.id, title: 'First' });
  const second = app.db.addStrip({ user_id: owner.id, title: 'Second' });
  await allow(first.id);
  await allow(second.id);
  const hidden = app.db.addStrip({ user_id: owner.id, title: 'Private' });

  const rejected = await app.api('POST', '/api/admin/spotlight', {
    as: admin,
    body: { stripId: hidden.id, slot: 'week' },
  });
  assert.equal(rejected.status, 400);

  const week = await app.api('POST', '/api/admin/spotlight', {
    as: admin,
    body: { stripId: first.id, slot: 'week', caption: 'Hello' },
  });
  assert.equal(week.status, 201);
  const replacement = await app.api('POST', '/api/admin/spotlight', {
    as: admin,
    body: { stripId: second.id, slot: 'week', caption: 'Next' },
  });
  assert.equal(replacement.status, 403);

  const removed = await app.api('DELETE', `/api/admin/spotlight/${week.body.pick.id}`, { as: admin });
  assert.equal(removed.status, 403);

  const home = await app.api('POST', '/api/admin/spotlight', {
    as: admin,
    body: { stripId: first.id, slot: 'home' },
  });
  assert.equal(home.status, 201);

  const listed = await app.api('GET', '/api/public/spotlight');
  assert.equal(listed.status, 200);
  assert.equal(listed.body.feature.title, 'First');
  assert.equal(listed.body.feature.caption, DETAILS.quote);
  assert.equal(listed.body.feature.credit, 'Avery');
  assert.equal(listed.body.feature.details.filter, DETAILS.filter);
  assert.equal(app.db.tables.picks.filter((pick) => pick.slot === 'week').length, 1);

  const adminList = await app.api('GET', '/api/admin/spotlight', { as: admin });
  assert.ok(adminList.body.weekLockedUntil);
  assert.ok(listed.body.home.some((item) => item.stripId === first.id));
  assert.equal(JSON.stringify(listed.body).includes('guest'), false);
  assert.equal(Object.hasOwn(listed.body.feature, 'email'), false);
});

test('a photo of the week drops off after 7 days and can then be replaced', async () => {
  const next = app.db.addStrip({ user_id: owner.id, title: 'New feature' });
  await allow(next.id);
  app.db.tables.picks
    .filter((row) => row.slot === 'week')
    .forEach((row) => {
      row.created_at = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    });

  const expired = await app.api('GET', '/api/public/spotlight');
  assert.equal(expired.body.feature, null);

  const replacement = await app.api('POST', '/api/admin/spotlight', {
    as: admin,
    body: { stripId: next.id, slot: 'week' },
  });
  assert.equal(replacement.status, 201);
  const listed = await app.api('GET', '/api/public/spotlight');
  assert.equal(listed.body.feature.title, 'New feature');
});

test('removing opt-in hides the strip from the public payload', async () => {
  const strip = app.db.addStrip({ user_id: owner.id, title: 'Soon gone' });
  await allow(strip.id);
  await app.api('POST', '/api/admin/spotlight', {
    as: admin,
    body: { stripId: strip.id, slot: 'home', caption: 'Shown' },
  });

  const visible = await app.api('GET', '/api/public/spotlight');
  assert.ok(visible.body.home.some((item) => item.stripId === strip.id));

  const revoked = await app.api('PATCH', `/api/strips/${strip.id}`, {
    as: owner,
    body: { spotlightOptIn: false },
  });
  assert.equal(revoked.status, 200);

  const hidden = await app.api('GET', '/api/public/spotlight');
  assert.equal(hidden.body.home.some((item) => item.stripId === strip.id), false);
  assert.equal(app.db.tables.picks.some((pick) => pick.strip_id === strip.id), false);
});
