const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startTestApp } = require('../test-support/testApp');

let app;
let host;
let otherHost;
let admin;
let extraHostN = 0;

function extraHost() {
  extraHostN += 1;
  return app.db.addUser({ email: `host-extra-${extraHostN}@x.com` });
}

const inMinutes = (minutes) => new Date(Date.now() + minutes * 60000).toISOString();

function eventDetails(overrides = {}) {
  return {
    name: 'Party',
    hostName: 'Alex',
    eventDate: '2026-11-20',
    startsAt: inMinutes(60),
    endsAt: inMinutes(180),
    location: 'The hall',
    welcomeMessage: 'Welcome to the booth.',
    ...overrides,
  };
}

before(async () => {
  app = await startTestApp();
  host = app.db.addUser({ email: 'host@x.com' });
  otherHost = app.db.addUser({ email: 'other@x.com' });
  admin = app.db.addUser({ email: 'admin@x.com', role: 'admin' });
});

after(() => app.stop());

// ---- start and end time

test('creating an event requires every detail except hashtags', async () => {
  const missing = await app.api('POST', '/api/events', { as: host, body: { name: 'No times' } });
  assert.equal(missing.status, 400);

  const withoutHashtags = await app.api('POST', '/api/events', { as: host, body: eventDetails({ name: 'No tags' }) });
  assert.equal(withoutHashtags.status, 201);
  assert.equal(withoutHashtags.body.event.hashtags, null);
  assert.equal(withoutHashtags.body.event.isActive, true);

  const startsAt = inMinutes(-30);
  const endsAt = inMinutes(60);
  const timed = await app.api('POST', '/api/events', {
    as: extraHost(),
    body: eventDetails({ name: 'Timed', eventDate: '2026-11-20', startsAt, endsAt }),
  });
  assert.equal(timed.status, 201);
  assert.deepEqual(
    [timed.body.event.eventDate, timed.body.event.startsAt, timed.body.event.endsAt],
    ['2026-11-20', startsAt, endsAt]
  );
});

test('admin can turn event creation off', async () => {
  const user = extraHost();
  assert.equal(
    (await app.api('POST', '/api/events', { as: user, body: eventDetails({ name: 'First' }) })).status,
    201
  );
  assert.equal((await app.api('GET', '/api/events', { as: user })).body.canCreate, true);

  const off = await app.api('PATCH', '/api/admin/settings', {
    as: admin,
    body: { eventCreationEnabled: false },
  });
  assert.equal(off.status, 200);
  assert.equal(off.body.settings.eventCreationEnabled, false);
  assert.equal((await app.api('GET', '/api/events', { as: user })).body.canCreate, false);
  const blocked = await app.api('POST', '/api/events', { as: user, body: eventDetails({ name: 'Second' }) });
  assert.equal(blocked.status, 403);

  const on = await app.api('PATCH', '/api/admin/settings', {
    as: admin,
    body: { eventCreationEnabled: true },
  });
  assert.equal(on.body.settings.eventCreationEnabled, true);
  assert.equal(
    (await app.api('POST', '/api/events', {
      as: user,
      body: eventDetails({
        name: 'Second',
        startsAt: inMinutes(200),
        endsAt: inMinutes(320),
      }),
    })).status,
    201
  );
});

test('impossible schedules are rejected', async () => {
  const create = (body) => app.api('POST', '/api/events', { as: host, body: eventDetails(body) });
  assert.equal((await create({ startsAt: inMinutes(60), endsAt: inMinutes(30) })).status, 400);
  assert.equal((await create({ endsAt: inMinutes(-5) })).status, 400);
  assert.equal((await create({ endsAt: 'tomorrow-ish' })).status, 400);
});

test('a host cannot create two live events that overlap in time', async () => {
  const owner = extraHost();
  const startsAt = inMinutes(120);
  const endsAt = inMinutes(240);
  const first = await app.api('POST', '/api/events', {
    as: owner,
    body: eventDetails({ name: 'First booking', startsAt, endsAt }),
  });
  assert.equal(first.status, 201);

  const blocked = await app.api('POST', '/api/events', {
    as: owner,
    body: eventDetails({
      name: 'Clash',
      startsAt: inMinutes(180),
      endsAt: inMinutes(300),
    }),
  });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.code, 'EVENT_SCHEDULE_OVERLAP');
  assert.match(blocked.body.error, /First booking/);

  const backToBack = await app.api('POST', '/api/events', {
    as: owner,
    body: eventDetails({
      name: 'Next slot',
      startsAt: endsAt,
      endsAt: inMinutes(360),
    }),
  });
  assert.equal(backToBack.status, 201);

  const other = extraHost();
  const sameTimeOtherHost = await app.api('POST', '/api/events', {
    as: other,
    body: eventDetails({ name: 'Other host ok', startsAt, endsAt }),
  });
  assert.equal(sameTimeOtherHost.status, 201);
});

test('a DATE column is sent as the calendar day, not a shifted timestamp', async () => {
  // mysql2 returns DATE columns as a Date at local midnight.
  const event = app.db.addEvent({ owner_id: host.id, name: 'Dated', event_date: new Date(2026, 10, 20) });
  const loaded = await app.api('GET', `/api/events/${event.id}`, { as: host });
  assert.equal(loaded.body.event.eventDate, '2026-11-20');

  const publicView = await app.api('GET', `/api/public/events/${event.code}`);
  assert.equal(publicView.body.event.eventDate, '2026-11-20');
});

test('editing keeps, changes or clears the schedule as asked', async () => {
  const endsAt = inMinutes(90);
  const owner = extraHost();
  const created = await app.api('POST', '/api/events', {
    as: owner,
    body: eventDetails({ name: 'Edit me', eventDate: '2026-11-20', endsAt }),
  });
  const { id } = created.body.event;
  const patch = (body) => app.api('PATCH', `/api/events/${id}`, { as: owner, body });

  assert.equal((await patch({ name: 'Renamed' })).body.event.endsAt, endsAt);
  assert.equal((await patch({ name: 'Renamed', endsAt: inMinutes(-1) })).status, 400);
  assert.equal(app.db.tables.events.find((e) => e.id === id).is_active, 1);

  const cleared = await patch({ name: 'Renamed', eventDate: null, startsAt: null, endsAt: null });
  assert.deepEqual(
    [cleared.body.event.eventDate, cleared.body.event.startsAt, cleared.body.event.endsAt],
    [null, null, null]
  );
});

test('an event closes itself at its end time and stays closed', async () => {
  const untouched = app.db.addEvent({ owner_id: host.id, name: 'No end time' });
  const passed = new Date(Date.now() - 60000);
  const event = app.db.addEvent({ owner_id: host.id, name: 'Ended', ends_at: passed });
  const photo = app.db.addStrip({ event_id: event.id, image_url: app.storeFile('auto-closed.png') });

  const guest = await app.api('GET', `/api/public/events/${event.code}`);
  assert.equal(guest.status, 200);
  assert.equal(guest.body.event.isActive, false);
  assert.equal(app.db.tables.strips.some((strip) => strip.id === photo.id), true);
  assert.equal(fs.existsSync(path.join(app.uploadsDir, 'auto-closed.png')), true);
  assert.equal((await app.guestUpload(event.code, 'guestkey-1234')).status, 403);

  const locked = await app.api('GET', `/api/events/${untouched.id}/strips`, { as: host });
  assert.equal(locked.body.photosLocked, true);
  assert.deepEqual(locked.body.strips, []);

  const revealed = await app.api('GET', `/api/events/${event.id}/strips`, { as: host });
  assert.equal(revealed.body.photosLocked, undefined);
  assert.equal(revealed.body.strips.length, 1);

  const hostView = await app.api('GET', `/api/events/${event.id}`, { as: host });
  assert.deepEqual(
    [hostView.body.event.isActive, hostView.body.event.status, hostView.body.event.completedAt],
    [false, 'completed', passed.toISOString()]
  );
  assert.equal(untouched.is_active, 1);

  // A completed event can still be edited, but it cannot be made live again.
  const edited = await app.api('PATCH', `/api/events/${event.id}`, { as: host, body: { name: 'Ended 2', endsAt: passed.toISOString() } });
  assert.equal(edited.status, 200);

  const reopened = await app.api('PATCH', `/api/events/${event.id}`, { as: host, body: { isActive: true } });
  assert.equal(reopened.status, 400);
  assert.equal((await app.api('GET', `/api/public/events/${event.code}`)).body.event.isActive, false);
});

test('ending by hand is permanent', async () => {
  const endsAt = inMinutes(120);
  const owner = extraHost();
  const created = await app.api('POST', '/api/events', { as: owner, body: eventDetails({ name: 'Manual', endsAt }) });
  const { id, code } = created.body.event;

  const photo = app.db.addStrip({ event_id: id, image_url: app.storeFile('ended-event.png') });

  const ended = await app.api('PATCH', `/api/events/${id}`, { as: owner, body: { isActive: false } });
  assert.equal(ended.body.event.isActive, false);
  assert.equal(ended.body.event.stripCount, 1);
  assert.ok(ended.body.event.completedAt);
  assert.equal(app.db.tables.strips.some((strip) => strip.id === photo.id), true);
  assert.equal(fs.existsSync(path.join(app.uploadsDir, 'ended-event.png')), true);

  const reopened = await app.api('PATCH', `/api/events/${id}`, { as: owner, body: { isActive: true } });
  assert.equal(reopened.status, 400);
  assert.equal((await app.api('GET', `/api/public/events/${code}`)).body.event.isActive, false);
});

// ---- host moderation

test('only the owner can remove a photo, and its file goes with it', async () => {
  const event = app.db.addEvent({ owner_id: host.id, name: 'Moderated' });
  const elsewhere = app.db.addEvent({ owner_id: otherHost.id, name: 'Someone else' });
  const photo = app.db.addStrip({ event_id: event.id, image_url: app.storeFile('remove-me.png') });
  const foreign = app.db.addStrip({ event_id: elsewhere.id, image_url: app.storeFile('not-yours.png') });
  const remove = (eventId, stripId, as) => app.api('DELETE', `/api/events/${eventId}/strips/${stripId}`, { as });

  assert.equal((await app.api('DELETE', `/api/events/${event.id}/strips/${photo.id}`)).status, 401);
  assert.equal((await remove(event.id, photo.id, otherHost)).status, 404);
  assert.equal((await remove(event.id, foreign.id, host)).status, 404);
  assert.ok(fs.existsSync(path.join(app.uploadsDir, 'remove-me.png')));

  assert.equal((await remove(event.id, photo.id, host)).status, 200);
  assert.equal(app.db.tables.strips.some((s) => s.id === photo.id), false);
  assert.equal(fs.existsSync(path.join(app.uploadsDir, 'remove-me.png')), false);
  assert.ok(fs.existsSync(path.join(app.uploadsDir, 'not-yours.png')));
});

test('only the owner can delete an event, and its photos go with it', async () => {
  const event = app.db.addEvent({ owner_id: host.id, name: 'Delete me' });
  const kept = app.db.addEvent({ owner_id: host.id, name: 'Keep me' });
  app.db.addStrip({ event_id: event.id, image_url: app.storeFile('gone-1.png') });
  app.db.addStrip({ event_id: event.id, image_url: app.storeFile('gone-2.png') });
  const keptPhoto = app.db.addStrip({ event_id: kept.id, image_url: app.storeFile('kept.png') });

  assert.equal((await app.api('DELETE', `/api/events/${event.id}`, { as: otherHost })).status, 404);
  assert.ok(app.db.tables.events.some((e) => e.id === event.id));

  assert.equal((await app.api('DELETE', `/api/events/${event.id}`, { as: host })).status, 200);
  assert.equal(app.db.tables.events.some((e) => e.id === event.id), false);
  assert.equal(app.db.tables.strips.some((s) => s.event_id === event.id), false);
  assert.equal(fs.existsSync(path.join(app.uploadsDir, 'gone-1.png')), false);
  assert.equal(fs.existsSync(path.join(app.uploadsDir, 'gone-2.png')), false);

  assert.ok(app.db.tables.strips.some((s) => s.id === keptPhoto.id));
  assert.ok(fs.existsSync(path.join(app.uploadsDir, 'kept.png')));
});

test('photo strips stay off until the host turns them on', async () => {
  const owner = extraHost();
  const created = await app.api('POST', '/api/events', { as: owner, body: eventDetails({ name: 'Photos only' }) });
  assert.equal(created.status, 201);
  assert.equal(created.body.event.stripsEnabled, false);
  const { id, code } = created.body.event;

  const guestOff = await app.api('GET', `/api/public/events/${code}`);
  assert.equal(guestOff.body.event.stripsEnabled, false);

  const enabled = await app.api('PATCH', `/api/events/${id}`, {
    as: owner,
    body: { name: 'Photos only', stripsEnabled: true },
  });
  assert.equal(enabled.status, 200);
  assert.equal(enabled.body.event.stripsEnabled, true);
  assert.equal((await app.api('GET', `/api/public/events/${code}`)).body.event.stripsEnabled, true);

  const disabled = await app.api('PATCH', `/api/events/${id}`, {
    as: owner,
    body: { name: 'Photos only', stripsEnabled: false },
  });
  assert.equal(disabled.body.event.stripsEnabled, false);
});
