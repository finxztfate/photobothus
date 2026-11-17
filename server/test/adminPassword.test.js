const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { startTestApp } = require('../test-support/testApp');

let app;
let admin;

const login = (password) =>
  app.api('POST', '/api/auth/login', { body: { email: 'admin@photobothus.local', password } });

before(async () => {
  app = await startTestApp();
  admin = app.db.addUser({
    email: 'admin@photobothus.local',
    role: 'admin',
    password_hash: bcrypt.hashSync('admin123', 4),
  });
});

after(() => app.stop());

test('signing in with the seeded password only allows changing it', async () => {
  const signedIn = await login('admin123');
  assert.equal(signedIn.status, 200);
  assert.equal(signedIn.body.user.mustChangePassword, true);
  const { token } = signedIn.body;

  const me = await app.api('GET', '/api/auth/me', { token });
  assert.equal(me.body.user.mustChangePassword, true);

  for (const url of ['/api/admin/users', '/api/admin/settings', '/api/admin/events']) {
    const blocked = await app.api('GET', url, { token });
    assert.equal(blocked.status, 403, url);
    assert.equal(blocked.body.code, 'PASSWORD_CHANGE_REQUIRED');
  }

  const sameAgain = await app.api('POST', '/api/admin/change-password', {
    token,
    body: { currentPassword: 'admin123', newPassword: 'admin123' },
  });
  assert.equal(sameAgain.status, 400);

  const changed = await app.api('POST', '/api/admin/change-password', {
    token,
    body: { currentPassword: 'admin123', newPassword: 'a-much-better-one' },
  });
  assert.equal(changed.status, 200);

  // The token handed back is a normal one: the dashboard opens without a new login.
  const unlocked = await app.api('GET', '/api/admin/settings', { token: changed.body.token });
  assert.equal(unlocked.status, 200);
  // The old, limited token stays limited.
  assert.equal((await app.api('GET', '/api/admin/settings', { token })).status, 403);
});

test('after the change the old password is dead and the new one is a normal login', async () => {
  assert.equal((await login('admin123')).status, 401);

  const signedIn = await login('a-much-better-one');
  assert.equal(signedIn.status, 200);
  assert.equal(signedIn.body.user.mustChangePassword, undefined);
  assert.equal((await app.api('GET', '/api/admin/settings', { token: signedIn.body.token })).status, 200);
});

test('a live site refuses the seeded password outright', async () => {
  admin.password_hash = bcrypt.hashSync('admin123', 4);
  process.env.NODE_ENV = 'production';
  try {
    const refused = await login('admin123');
    assert.equal(refused.status, 403);
    assert.match(refused.body.error, /default admin password is disabled/i);
    assert.equal(refused.body.token, undefined);
  } finally {
    delete process.env.NODE_ENV;
  }
});

test('a customer cannot reach admin routes', async () => {
  const customer = app.db.addUser({ email: 'c@x.com' });
  assert.equal((await app.api('GET', '/api/admin/settings', { as: customer })).status, 403);
  assert.equal((await app.api('GET', '/api/admin/settings')).status, 401);
});
