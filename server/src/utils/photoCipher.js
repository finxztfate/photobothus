const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// AES-256-GCM. The key never goes in the database. A copy of the photo
// files cannot be opened without it.
const MAGIC = Buffer.from('PBENC1');
const KEY_FILE = path.join(__dirname, '..', '..', '.photo-key');

let cachedKey = null;

function isLiveSite() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT);
}

function normalizeKeyHex(value) {
  let s = String(value || '').trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  // Railway / pasted secrets sometimes include whitespace or newlines.
  return s.replace(/\s+/g, '');
}

function keyFromHex(value) {
  const hex = normalizeKeyHex(value);
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      `PHOTO_ENCRYPTION_KEY must be 64 hex characters (0-9a-f); got length=${hex.length}`
    );
  }
  return Buffer.from(hex, 'hex');
}

function photoKey() {
  if (cachedKey) return cachedKey;

  if (process.env.PHOTO_ENCRYPTION_KEY) {
    cachedKey = keyFromHex(process.env.PHOTO_ENCRYPTION_KEY);
    return cachedKey;
  }

  if (isLiveSite()) {
    throw new Error('PHOTO_ENCRYPTION_KEY must be set in production');
  }

  if (fs.existsSync(KEY_FILE)) {
    cachedKey = keyFromHex(fs.readFileSync(KEY_FILE, 'utf8'));
    return cachedKey;
  }

  cachedKey = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, cachedKey.toString('hex'), { mode: 0o600 });
  return cachedKey;
}

function isEncryptedPhoto(bytes) {
  return Buffer.isBuffer(bytes) && bytes.length >= MAGIC.length && bytes.subarray(0, MAGIC.length).equals(MAGIC);
}

function encryptPhoto(plain, mime) {
  const mimeBuf = Buffer.from(String(mime || 'image/jpeg'), 'utf8');
  if (mimeBuf.length > 255) {
    throw new Error('Image type is too long to store');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', photoKey(), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, Buffer.from([mimeBuf.length]), mimeBuf, iv, tag, body]);
}

function decryptPhoto(stored) {
  if (!isEncryptedPhoto(stored)) return null;
  const mimeLen = stored[MAGIC.length];
  const mimeStart = MAGIC.length + 1;
  const mimeEnd = mimeStart + mimeLen;
  if (mimeEnd + 12 + 16 > stored.length) {
    throw new Error('Encrypted photo is incomplete');
  }
  const mime = stored.subarray(mimeStart, mimeEnd).toString('utf8');
  const iv = stored.subarray(mimeEnd, mimeEnd + 12);
  const tag = stored.subarray(mimeEnd + 12, mimeEnd + 28);
  const body = stored.subarray(mimeEnd + 28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', photoKey(), iv);
  decipher.setAuthTag(tag);
  return { buffer: Buffer.concat([decipher.update(body), decipher.final()]), mime };
}

module.exports = {
  photoKey,
  isEncryptedPhoto,
  encryptPhoto,
  decryptPhoto,
};
