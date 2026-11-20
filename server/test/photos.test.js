const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp, TINY_PNG } = require('../test-support/testApp');

let app;
let host;
let otherHost;
let admin;

before(async () => {
  app = await startTestApp();
  host = app.db.addUser({ email: 'host@x.com' });
  otherHost = app.db.addUser({ email: 'other@x.com' });
  admin = app.db.addUser({ email: 'admin@x.com', role: 'admin' });
});

after(() => app.stop());

// Follows nextCursor until the list runs out and returns the ids of every page.
async function readAllPages(url, as, limit) {
  const pages = [];
  let cursor = null;
  for (let guard = 0; guard < 50; guard += 1) {
    const query = `?limit=${limit}${cursor ? `&before=${cursor}` : ''}`;
    const { status, body } = await app.api('GET', `${url}${query}`, { as });
    assert.equal(status, 200);
    pages.push(body.strips.map((strip) => strip.id));
    if (!body.hasMore) {
      assert.equal(body.nextCursor, null);
      return pages;
    }
    cursor = body.nextCursor;
  }
  throw new Error('pagination never ended');
}

// File names stored in a ZIP, read from its central directory.
function zipEntryNames(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0, 'not a ZIP file');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const names = [];
  for (let i = 0; i < count; i += 1) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    names.push(buffer.toString('utf8', offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

// ---- pagination

test('an event gallery is paged newest first, with no gaps or repeats', async () => {
  const event = app.db.addEvent({ owner_id: host.id, name: 'Big event', is_active: 0 });
  const ids = [];
  for (let i = 0; i < 7; i += 1) {
    ids.push(app.db.addStrip({ event_id: event.id, guest_key: `guest-${i % 3}` }).id);
  }
  const newestFirst = [...ids].reverse();

  const pages = await readAllPages(`/api/events/${event.id}/strips`, host, 3);
  assert.deepEqual(pages.map((page) => page.length), [3, 3, 1]);
  assert.deepEqual(pages.flat(), newestFirst);

  // Totals come from the event itself, not from whichever page is loaded.
  const loaded = await app.api('GET', `/api/events/${event.id}`, { as: host });
  assert.deepEqual([loaded.body.event.stripCount, loaded.body.event.guestCount], [7, 3]);

  assert.equal((await app.api('GET', `/api/events/${event.id}/strips`, { as: otherHost })).status, 404);
});

test('page size has a default and a ceiling', async () => {
  const event = app.db.addEvent({ owner_id: host.id, name: 'Huge event', is_active: 0 });
  for (let i = 0; i < 130; i += 1) app.db.addStrip({ event_id: event.id });
  const url = `/api/events/${event.id}/strips`;

  assert.equal((await app.api('GET', url, { as: host })).body.strips.length, 24);
  assert.equal((await app.api('GET', `${url}?limit=5000`, { as: host })).body.strips.length, 100);
  assert.equal((await app.api('GET', `${url}?limit=nonsense`, { as: host })).body.strips.length, 24);
});

test('My Gallery lists only the signed-in user’s own personal strips, in pages', async () => {
  const event = app.db.addEvent({ owner_id: host.id, name: 'Not personal' });
  const mine = [];
  for (let i = 0; i < 5; i += 1) mine.push(app.db.addStrip({ user_id: host.id }).id);
  app.db.addStrip({ user_id: otherHost.id });
  app.db.addStrip({ user_id: host.id, event_id: event.id });

  const pages = await readAllPages('/api/strips', host, 2);
  assert.deepEqual(pages.map((page) => page.length), [2, 2, 1]);
  assert.deepEqual(pages.flat(), [...mine].reverse());
});

test('deleting selected gallery photos removes only that customer’s own strips', async () => {
  const mine = [app.db.addStrip({ user_id: host.id }), app.db.addStrip({ user_id: host.id })];
  const other = app.db.addStrip({ user_id: otherHost.id });
  const refused = await app.api('DELETE', '/api/strips', {
    as: host,
    body: { ids: [mine[0].id, other.id] },
  });
  assert.equal(refused.status, 404);
  assert.ok(app.db.tables.strips.some((row) => row.id === mine[0].id));

  const removed = await app.api('DELETE', '/api/strips', {
    as: host,
    body: { ids: mine.map((strip) => strip.id) },
  });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.deleted, 2);
  assert.equal(app.db.tables.strips.some((row) => mine.some((strip) => strip.id === row.id)), false);
  assert.ok(app.db.tables.strips.some((row) => row.id === other.id));
});

test('an admin cannot list or delete customer strips', async () => {
  const strip = app.db.addStrip({ user_id: host.id, title: 'Private' });
  assert.equal((await app.api('GET', '/api/admin/strips', { as: admin })).status, 404);
  assert.equal((await app.api('DELETE', `/api/admin/strips/${strip.id}`, { as: admin })).status, 404);
  assert.ok(app.db.tables.strips.some((row) => row.id === strip.id));
});

test('a guest is stopped after 3 uploads to the same event', async () => {
  const event = app.db.addEvent({ owner_id: host.id, name: 'Guest cap' });
  const key = 'guest-threelimit';
  assert.equal((await app.guestUpload(event.code, key)).status, 201);
  assert.equal((await app.guestUpload(event.code, key)).status, 201);
  const third = await app.guestUpload(event.code, key);
  assert.equal(third.status, 201);
  assert.equal(third.body.uploadsRemaining, 0);
  assert.equal(third.body.maxGuestUploads, 3);

  const refused = await app.guestUpload(event.code, key);
  assert.equal(refused.status, 403);
  assert.match(refused.body.error, /3 photos/);
});

// ---- per-event photo cap

test('an event stops accepting photos at the event limit, whatever guest key is sent', async () => {
  const saved = await app.api('PATCH', '/api/admin/settings', { as: admin, body: { maxEventUploads: 3 } });
  assert.equal(saved.body.settings.maxEventUploads, 3);
  const event = app.db.addEvent({ owner_id: host.id, name: 'Small event' });

  // Three different "guests": the per-guest limit of 3 never comes into play.
  for (const key of ['guest-aaaaaaaa', 'guest-bbbbbbbb', 'guest-cccccccc']) {
    assert.equal((await app.guestUpload(event.code, key)).status, 201);
  }

  const refused = await app.guestUpload(event.code, 'guest-dddddddd');
  assert.equal(refused.status, 403);
  assert.equal(refused.body.code, 'EVENT_FULL');
  assert.equal(app.db.tables.strips.filter((s) => s.event_id === event.id).length, 3);

  const landing = await app.api('GET', `/api/public/events/${event.code}?guestKey=guest-dddddddd`);
  assert.equal(landing.body.event.eventFull, true);

  // Removing a photo makes room again.
  const [first] = app.db.tables.strips.filter((s) => s.event_id === event.id);
  await app.api('DELETE', `/api/events/${event.id}/strips/${first.id}`, { as: host });
  assert.equal((await app.guestUpload(event.code, 'guest-dddddddd')).status, 201);

  await app.api('PATCH', '/api/admin/settings', { as: admin, body: { maxEventUploads: 500 } });
});

test('the event limit must be a sensible number', async () => {
  const save = (maxEventUploads) => app.api('PATCH', '/api/admin/settings', { as: admin, body: { maxEventUploads } });
  assert.equal((await save(0)).status, 400);
  assert.equal((await save(10001)).status, 400);
  assert.equal((await save('lots')).status, 400);
});

// ---- download all as one ZIP

test('Download All is blocked while the event is live', async () => {
  const event = app.db.addEvent({ owner_id: host.id, name: 'Still going' });
  app.db.addStrip({ event_id: event.id, image_url: app.storeFile('live.png') });
  const live = await app.api('GET', `/api/events/${event.id}/download`, { as: host });
  assert.equal(live.status, 403);
  assert.match(live.body.error, /after the event ends/i);
});

test('Download All sends every photo of the event as one ZIP', async () => {
  const event = app.db.addEvent({ owner_id: host.id, name: 'Ana & Marco Wedding', is_active: 0 });
  app.db.addStrip({ event_id: event.id, title: 'Classic Strip', image_url: app.storeFile('zip-a.png') });
  app.db.addStrip({ event_id: event.id, title: null, image_url: app.storeFile('zip-b.jpg') });
  app.db.addStrip({ event_id: event.id, title: 'lost file', image_url: 'never-saved.png' });
  const token = app.signToken(host);

  const response = await fetch(`${app.baseUrl}/api/events/${event.id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/zip');
  assert.match(response.headers.get('content-disposition'), /attachment; filename="Ana_Marco_Wedding-photos\.zip"/);

  const zip = Buffer.from(await response.arrayBuffer());
  assert.deepEqual(zipEntryNames(zip), ['001-Classic_Strip.png', '002-photo.jpg']);
  // Stored uncompressed, so the image bytes are in the archive exactly as uploaded.
  assert.ok(zip.includes(TINY_PNG));
});

test('Download All is owner-only and says so when there is nothing to send', async () => {
  const event = app.db.addEvent({ owner_id: host.id, name: 'Empty', is_active: 0 });
  assert.equal((await app.api('GET', `/api/events/${event.id}/download`, { as: otherHost })).status, 404);
  assert.equal((await app.api('GET', `/api/events/${event.id}/download`)).status, 401);

  const empty = await app.api('GET', `/api/events/${event.id}/download`, { as: host });
  assert.equal(empty.status, 404);
  assert.match(empty.body.error, /no photos to download/i);
});
