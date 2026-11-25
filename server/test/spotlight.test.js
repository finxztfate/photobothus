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
  layout: 'Classic Strip',
  device: 'Phone',
  socialNetwork: 'instagram',
  social: 'avery.shots',
};

async function submit(stripId, as = owner) {
  return app.api('PATCH', `/api/strips/${stripId}`, {
    as,
    body: { spotlightOptIn: true, details: DETAILS },
  });
}

async function approve(stripId) {
  return app.api('POST', '/api/admin/spotlight/review', {
    as: admin,
    body: { stripId, action: 'approve' },
  });
}

async function allow(stripId, as = owner) {
  const submitted = await submit(stripId, as);
  if (submitted.status !== 200) return submitted;
  const reviewed = await approve(stripId);
  assert.equal(reviewed.status, 200);
  return submitted;
}

async function optOutAll(user) {
  const opted = app.db.tables.strips.filter((strip) => strip.user_id === user.id && strip.spotlight_opt_in);
  for (const strip of opted) {
    await app.api('PATCH', `/api/strips/${strip.id}`, { as: user, body: { spotlightOptIn: false } });
  }
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
  assert.equal(allowed.body.spotlightStatus, 'pending');
  assert.equal(allowed.body.spotlightDetails.quote, DETAILS.quote);

  const listed = await app.api('GET', '/api/strips', { as: owner });
  const saved = listed.body.strips.find((item) => item.id === strip.id);
  assert.equal(saved.spotlightOptIn, true);
  assert.equal(saved.spotlightStatus, 'approved');
  assert.equal(saved.spotlightDetails.location, DETAILS.location);
});

test('Spotlight submissions stay private until an admin approves them', async () => {
  await optOutAll(owner);
  const strip = app.db.addStrip({ user_id: owner.id, title: 'Needs review' });
  const submitted = await submit(strip.id);
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.spotlightStatus, 'pending');

  const before = await app.api('GET', '/api/public/spotlight');
  assert.equal(before.body.entries.some((item) => item.stripId === strip.id), false);

  const liked = await app.api('POST', '/api/spotlight/likes', { as: other, body: { stripId: strip.id } });
  assert.equal(liked.status, 404);

  const approved = await approve(strip.id);
  assert.equal(approved.status, 200);
  assert.equal(approved.body.spotlightStatus, 'approved');

  const after = await app.api('GET', '/api/public/spotlight');
  assert.equal(after.body.entries.some((item) => item.stripId === strip.id), true);

  await optOutAll(owner);
  const again = app.db.addStrip({ user_id: owner.id, title: 'Rejected shot' });
  await submit(again.id);
  const rejected = await app.api('POST', '/api/admin/spotlight/review', {
    as: admin,
    body: { stripId: again.id, action: 'reject' },
  });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.spotlightStatus, 'rejected');
  assert.equal(again.spotlight_opt_in, 0);

  const hidden = await app.api('GET', '/api/public/spotlight');
  assert.equal(hidden.body.entries.some((item) => item.stripId === again.id), false);
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

test('an admin can feature only an opted-in personal strip, and the week pick stays until Sunday', async () => {
  await optOutAll(owner);
  await optOutAll(other);
  const first = app.db.addStrip({ user_id: owner.id, title: 'First' });
  const second = app.db.addStrip({ user_id: other.id, title: 'Second' });
  await allow(first.id);
  await allow(second.id, other);
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
  assert.equal(listed.body.feature.details.layout, DETAILS.layout);
  assert.equal(listed.body.feature.details.social, DETAILS.social);
  assert.equal(listed.body.feature.details.socialNetwork, 'instagram');
  assert.equal(app.db.tables.picks.filter((pick) => pick.slot === 'week').length, 1);

  const adminList = await app.api('GET', '/api/admin/spotlight', { as: admin });
  assert.ok(adminList.body.weekLockedUntil);
  assert.ok(listed.body.home.some((item) => item.stripId === first.id));
  assert.equal(JSON.stringify(listed.body).includes('guest'), false);
  assert.equal(Object.hasOwn(listed.body.feature, 'email'), false);
});

let likeSeq = 0;
function seedLikes(stripId, weekStart, count) {
  for (let i = 0; i < count; i += 1) {
    likeSeq += 1;
    const voter = app.db.addUser({
      email: `like-${likeSeq}@x.com`,
      display_name: `Voter ${likeSeq}`,
    });
    app.db.addLike({ user_id: voter.id, strip_id: stripId, week_start: weekStart });
  }
}

function ageWeekPick() {
  app.db.tables.picks
    .filter((row) => row.slot === 'week')
    .forEach((row) => {
      row.created_at = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    });
}

test('a week pick is empty without 10 likes, and 10 likes crown the new week', async () => {
  const { previousWeekStartKey, WEEK_WIN_MIN_LIKES } = require('../src/utils/spotlight');
  await optOutAll(other);
  const voterHost = app.db.addUser({ email: 'voter-host@x.com', display_name: 'VoterHost' });
  const next = app.db.addStrip({ user_id: voterHost.id, title: 'Voted strip', layout_id: 2 });
  await allow(next.id, voterHost);
  const prevWeek = previousWeekStartKey(new Date());

  ageWeekPick();
  const empty = await app.api('GET', '/api/public/spotlight');
  assert.equal(empty.body.feature, null);
  assert.equal(empty.body.week.winMinLikes, WEEK_WIN_MIN_LIKES);

  seedLikes(next.id, prevWeek, WEEK_WIN_MIN_LIKES - 1);
  ageWeekPick();
  const stillEmpty = await app.api('GET', '/api/public/spotlight');
  assert.equal(stillEmpty.body.feature, null);

  seedLikes(next.id, prevWeek, 1);
  ageWeekPick();
  const crowned = await app.api('GET', '/api/public/spotlight');
  assert.equal(crowned.body.feature.title, 'Voted strip');
  assert.equal(crowned.body.feature.layoutId, 2);
});

test('contest entries drop off after the week resets', async () => {
  const { previousWeekStartKey, weekStartKey } = require('../src/utils/spotlight');
  const currentWeek = weekStartKey(new Date());
  const prevWeek = previousWeekStartKey(new Date());
  const fresh = app.db.addUser({ email: 'fresh@x.com', display_name: 'Fresh' });
  const stale = app.db.addStrip({ user_id: fresh.id, title: 'Last week entry' });
  await allow(stale.id, fresh);
  stale.spotlight_week_start = prevWeek;

  const listed = await app.api('GET', '/api/public/spotlight');
  assert.equal(listed.body.week.start, currentWeek);
  assert.equal(listed.body.entries.some((item) => item.stripId === stale.id), false);
  assert.equal(stale.spotlight_opt_in, 0);
});

test('a customer can enter only one strip at a time', async () => {
  const solo = app.db.addUser({ email: 'solo@x.com', display_name: 'Solo' });
  const first = app.db.addStrip({ user_id: solo.id, title: 'Entry A' });
  const second = app.db.addStrip({ user_id: solo.id, title: 'Entry B' });
  assert.equal((await allow(first.id, solo)).status, 200);
  const next = await allow(second.id, solo);
  assert.equal(next.status, 409);
  assert.equal(next.body.code, 'SPOTLIGHT_ENTRY_LIMIT');
  assert.equal(first.spotlight_opt_in, 1);
  assert.equal(second.spotlight_opt_in, 0);
});

test('signed-in users can like a contest strip once per week, and ties go to the earlier like', async () => {
  const hostA = app.db.addUser({ email: 'tirea@x.com', display_name: 'Tirea' });
  const hostB = app.db.addUser({ email: 'tireb@x.com', display_name: 'Tireb' });
  const a = app.db.addStrip({ user_id: hostA.id, title: 'Tie A' });
  const b = app.db.addStrip({ user_id: hostB.id, title: 'Tie B' });
  await allow(a.id, hostA);
  await allow(b.id, hostB);

  const guestLike = await app.api('POST', '/api/spotlight/likes', { body: { stripId: a.id } });
  assert.equal(guestLike.status, 401);

  const likeA = await app.api('POST', '/api/spotlight/likes', { as: admin, body: { stripId: a.id } });
  assert.equal(likeA.status, 201);
  const again = await app.api('POST', '/api/spotlight/likes', { as: admin, body: { stripId: a.id } });
  assert.equal(again.status, 200);

  const unlike = await app.api('DELETE', `/api/spotlight/likes/${a.id}`, { as: admin });
  assert.equal(unlike.body.liked, false);

  const listed = await app.api('GET', '/api/public/spotlight', { as: hostA });
  const entry = listed.body.entries.find((item) => item.stripId === b.id);
  assert.ok(entry);
  assert.equal(entry.likedByMe, false);

  const { previousWeekStartKey, WEEK_WIN_MIN_LIKES } = require('../src/utils/spotlight');
  const prevWeek = previousWeekStartKey(new Date());
  const early = new Date('2020-01-01T00:00:00Z');
  const late = new Date('2020-01-01T01:00:00Z');
  seedLikes(b.id, prevWeek, WEEK_WIN_MIN_LIKES);
  app.db.tables.likes
    .filter((like) => like.strip_id === b.id && String(like.week_start) === prevWeek)
    .forEach((like) => {
      like.created_at = early;
    });
  seedLikes(a.id, prevWeek, WEEK_WIN_MIN_LIKES + 1);
  app.db.tables.likes
    .filter((like) => like.strip_id === a.id && String(like.week_start) === prevWeek)
    .forEach((like) => {
      like.created_at = late;
    });
  ageWeekPick();

  const afterTie = await app.api('GET', '/api/public/spotlight');
  assert.equal(afterTie.body.feature.title, 'Tie A');

  app.db.tables.likes = app.db.tables.likes.filter((like) => like.strip_id !== a.id || String(like.week_start) !== prevWeek);
  seedLikes(a.id, prevWeek, WEEK_WIN_MIN_LIKES);
  app.db.tables.likes
    .filter((like) => like.strip_id === a.id && String(like.week_start) === prevWeek)
    .forEach((like) => {
      like.created_at = late;
    });
  ageWeekPick();
  const tied = await app.api('GET', '/api/public/spotlight');
  assert.equal(tied.body.feature.title, 'Tie B');
});

test('removing opt-in hides the strip from the public payload', async () => {
  await optOutAll(owner);
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
