const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('../test-support/testApp');

let app;
let host;
let admin;

const inMinutes = (minutes) => new Date(Date.now() + minutes * 60000).toISOString();

function eventDetails(overrides = {}) {
  return {
    name: 'Ticketed party',
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
  host = app.db.addUser({ email: 'ticket-host@x.com', event_tickets: 1, potw_wins: 0 });
  admin = app.db.addUser({ email: 'ticket-admin@x.com', role: 'admin' });
});

after(() => app.stop());

test('creating an event spends one ticket and blocks at zero', async () => {
  const listed = await app.api('GET', '/api/events', { as: host });
  assert.equal(listed.body.tickets, 1);

  const created = await app.api('POST', '/api/events', { as: host, body: eventDetails() });
  assert.equal(created.status, 201);

  const after = await app.api('GET', '/api/events', { as: host });
  assert.equal(after.body.tickets, 0);

  const blocked = await app.api('POST', '/api/events', {
    as: host,
    body: eventDetails({
      name: 'Second',
      startsAt: inMinutes(200),
      endsAt: inMinutes(320),
    }),
  });
  assert.equal(blocked.status, 402);
  assert.equal(blocked.body.code, 'EVENT_TICKET_REQUIRED');
});

test('admin can grant a purchased ticket pack', async () => {
  const broke = app.db.addUser({ email: 'broke-host@x.com', event_tickets: 0 });
  const denied = await app.api('POST', '/api/admin/tickets', { as: broke, body: { userId: broke.id, tickets: 5 } });
  assert.equal(denied.status, 403);

  const granted = await app.api('POST', '/api/admin/tickets', {
    as: admin,
    body: { userId: broke.id, tickets: 5, note: 'Paid 5-ticket pack' },
  });
  assert.equal(granted.status, 201);
  assert.equal(granted.body.tickets, 5);

  const created = await app.api('POST', '/api/events', { as: broke, body: eventDetails({ name: 'Bought' }) });
  assert.equal(created.status, 201);
  assert.equal((await app.api('GET', '/api/events', { as: broke })).body.tickets, 4);
});

test('three Photo of the Week wins grant one event ticket', async () => {
  const { previousWeekStartKey, weekStartKey, WEEK_WIN_MIN_LIKES } = require('../src/utils/spotlight');
  const winner = app.db.addUser({ email: 'potw-star@x.com', event_tickets: 0, potw_wins: 0 });
  const prevWeek = previousWeekStartKey(new Date());
  const strip = app.db.addStrip({
    user_id: winner.id,
    title: 'Winning strip',
    spotlight_opt_in: 1,
    spotlight_status: 'approved',
    spotlight_week_start: weekStartKey(new Date()),
  });

  function ageWeekPick() {
    app.db.tables.picks
      .filter((row) => row.slot === 'week')
      .forEach((row) => {
        row.created_at = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      });
  }

  function seedLikes() {
    for (let i = 0; i < WEEK_WIN_MIN_LIKES; i += 1) {
      const voter = app.db.addUser({ email: `potw-like-${Date.now()}-${Math.random()}@x.com` });
      app.db.addLike({ user_id: voter.id, strip_id: strip.id, week_start: prevWeek });
    }
  }

  for (let round = 1; round <= 3; round += 1) {
    app.db.tables.likes = app.db.tables.likes.filter((like) => like.strip_id !== strip.id);
    seedLikes();
    ageWeekPick();
    const listed = await app.api('GET', '/api/public/spotlight');
    assert.equal(listed.body.feature.title, 'Winning strip');
  }

  const account = await app.api('GET', '/api/tickets', { as: winner });
  assert.equal(account.body.potwWins, 3);
  assert.equal(account.body.tickets, 1);
});

test('Pack and Host include bonus tickets on fulfillment', async () => {
  const { ticketsGrantedForPack } = require('../src/utils/tickets');
  assert.equal(ticketsGrantedForPack(1), 1);
  assert.equal(ticketsGrantedForPack(5), 6);
  assert.equal(ticketsGrantedForPack(10), 12);

  const listed = await app.api('GET', '/api/tickets', { as: host });
  assert.equal(listed.body.bonuses[5], 1);
  assert.equal(listed.body.bonuses[10], 2);
  assert.equal(listed.body.granted[5], 6);
  assert.equal(listed.body.granted[10], 12);
});
