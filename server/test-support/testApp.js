// Starts the real routers on a throwaway port, backed by the in-memory database.
// Environment the server reads at load time is set here, before anything is required.

const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.JWT_SECRET = 'test-secret';
process.env.PHOTO_ENCRYPTION_KEY = 'ab'.repeat(32);
delete process.env.NODE_ENV;
delete process.env.RAILWAY_ENVIRONMENT;
const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'photobothus-test-'));
process.env.UPLOADS_DIR = uploadsDir;

const express = require('express');
const { installFakeDb } = require('./fakeDb');

// The smallest valid PNG: enough for the upload check, which reads the file header.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

async function startTestApp() {
  const db = installFakeDb();
  const { signToken } = require('../src/middleware/auth');

  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../src/routes/auth'));
  app.use('/api/events', require('../src/routes/events'));
  app.use('/api/strips', require('../src/routes/strips'));
  app.use('/api/public', require('../src/routes/public'));
  app.use('/api/admin', require('../src/routes/admin'));

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  /** JSON request. `as` signs the request in as that user; `token` uses a specific token. */
  async function api(method, url, { as, token, body } = {}) {
    const bearer = token || (as ? signToken(as) : null);
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: {
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return { status: response.status, body: json, headers: response.headers };
  }

  /** Uploads a photo the way a guest's browser does. */
  async function guestUpload(code, guestKey) {
    const form = new FormData();
    form.append('image', new Blob([TINY_PNG], { type: 'image/png' }), 'photo.png');
    form.append('guestKey', guestKey);
    const response = await fetch(`${baseUrl}/api/public/events/${code}/strips`, { method: 'POST', body: form });
    return { status: response.status, body: await response.json() };
  }

  /** Puts a real file in the uploads folder and returns its storage key. */
  function storeFile(name, contents = TINY_PNG) {
    fs.writeFileSync(path.join(uploadsDir, name), contents);
    return name;
  }

  async function stop() {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  }

  return { db, api, guestUpload, storeFile, stop, baseUrl, signToken, uploadsDir };
}

module.exports = { startTestApp, TINY_PNG };
