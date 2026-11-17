const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { startTestApp } = require('../test-support/testApp');

let app;

before(async () => {
  app = await startTestApp();
  app.db.addUser({ email: 'host@x.com', role: 'admin', password_hash: bcrypt.hashSync('correct-horse', 4) });
});

after(() => app.stop());

test('ten failed logins lock the address out, even for the right password', async () => {
  const attempt = (password) =>
    app.api('POST', '/api/auth/login', { body: { email: 'host@x.com', password } });

  // Successful logins never use up the allowance.
  for (let i = 0; i < 3; i += 1) {
    assert.equal((await attempt('correct-horse')).status, 200);
  }

  for (let i = 0; i < 10; i += 1) {
    assert.equal((await attempt(`wrong-${i}`)).status, 401, `attempt ${i + 1}`);
  }

  const blocked = await attempt('correct-horse');
  assert.equal(blocked.status, 429);
  assert.match(blocked.body.error, /too many failed login attempts/i);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
});
