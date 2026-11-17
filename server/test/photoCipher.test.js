const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.PHOTO_ENCRYPTION_KEY = 'cd'.repeat(32);

const { encryptPhoto, decryptPhoto, isEncryptedPhoto } = require('../src/utils/photoCipher');

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

test('a photo encrypts so the file is not a readable image, then decrypts back', () => {
  const stored = encryptPhoto(TINY_PNG, 'image/png');
  assert.equal(isEncryptedPhoto(stored), true);
  assert.equal(stored.subarray(0, 8).equals(TINY_PNG.subarray(0, 8)), false);
  const opened = decryptPhoto(stored);
  assert.equal(opened.mime, 'image/png');
  assert.ok(opened.buffer.equals(TINY_PNG));
});
