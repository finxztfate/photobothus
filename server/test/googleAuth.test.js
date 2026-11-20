const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('../test-support/testApp');
const googleIdentity = require('../src/utils/googleIdentity');

const payloads = {
  'token-new': {
    email: 'new@gmail.com',
    sub: 'google-new',
    name: 'New Guest',
    picture: 'https://example.com/new.png',
  },
  'token-old': {
    email: 'old@gmail.com',
    sub: 'google-old',
    name: 'Old Guest',
    picture: null,
  },
  'token-stray': {
    email: 'stray@gmail.com',
    sub: 'google-stray',
    name: 'Stray Guest',
    picture: null,
  },
};

let app;
let originalVerify;

before(async () => {
  process.env.GOOGLE_CLIENT_ID = 'test-google-client';
  originalVerify = googleIdentity.verifyGoogleIdToken;
  googleIdentity.verifyGoogleIdToken = async (credential) => {
    const payload = payloads[credential];
    if (!payload) throw new Error('invalid token');
    return payload;
  };
  app = await startTestApp();
  app.db.addUser({
    email: 'old@gmail.com',
    google_id: 'google-old',
    display_name: 'Old Guest',
    role: 'customer',
  });
  app.db.addUser({
    email: 'admin@photobothus.local',
    role: 'admin',
    password_hash: 'hashed',
  });
});

after(async () => {
  googleIdentity.verifyGoogleIdToken = originalVerify;
  await app.stop();
});

test('Google login does not create an account', async () => {
  const response = await app.api('POST', '/api/auth/google', {
    body: { credential: 'token-new', mode: 'login' },
  });
  assert.equal(response.status, 404);
  assert.match(response.body.error, /sign up first/i);
  assert.equal(
    app.db.tables.users.some((user) => user.email === 'new@gmail.com'),
    false
  );
});

test('Google signup creates an account, then login works', async () => {
  const created = await app.api('POST', '/api/auth/google', {
    body: { credential: 'token-new', mode: 'signup' },
  });
  assert.equal(created.status, 200);
  assert.equal(created.body.user.email, 'new@gmail.com');
  assert.equal(created.body.user.role, 'customer');
  assert.ok(created.body.token);

  const again = await app.api('POST', '/api/auth/google', {
    body: { credential: 'token-new', mode: 'signup' },
  });
  assert.equal(again.status, 409);
  assert.match(again.body.error, /already has a Photobothus account/i);

  const login = await app.api('POST', '/api/auth/google', {
    body: { credential: 'token-new', mode: 'login' },
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.email, 'new@gmail.com');
});

test('Google login works for an existing account', async () => {
  const response = await app.api('POST', '/api/auth/google', {
    body: { credential: 'token-old', mode: 'login' },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.user.email, 'old@gmail.com');
});

test('Google login with no mode does not create an account', async () => {
  const response = await app.api('POST', '/api/auth/google', {
    body: { credential: 'token-stray' },
  });
  assert.equal(response.status, 404);
  assert.equal(
    app.db.tables.users.some((user) => user.email === 'stray@gmail.com'),
    false
  );
});
