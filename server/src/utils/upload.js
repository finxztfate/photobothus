const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const multer = require('multer');
const crypto = require('crypto');
const { encryptPhoto, decryptPhoto, isEncryptedPhoto } = require('./photoCipher');
const { createLimiter } = require('./concurrency');

// On Railway, point UPLOADS_DIR at a mounted volume or uploads are lost on every deploy.
// New photos are stored as YYYY/MM/DD/<random>.<ext> so one directory never holds every file.
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', '..', 'uploads');

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

// Encrypt/decrypt is CPU + memory heavy; only a few run at once so a booth
// full of guests cannot stall the whole Node process.
const photoWork = createLimiter(Number(process.env.PHOTO_CONCURRENCY || 3), {
  maxQueued: Number(process.env.PHOTO_QUEUE_LIMIT || 40),
});

function datedPrefix(date = new Date()) {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return path.join(year, month, day);
}

function sniffImage(header) {
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return { ext: '.jpg', mime: 'image/jpeg' };
  }
  if (
    header.length >= 8 &&
    header[0] === 0x89 &&
    header.toString('ascii', 1, 4) === 'PNG'
  ) {
    return { ext: '.png', mime: 'image/png' };
  }
  if (
    header.length >= 6 &&
    (header.toString('ascii', 0, 6) === 'GIF87a' || header.toString('ascii', 0, 6) === 'GIF89a')
  ) {
    return { ext: '.gif', mime: 'image/gif' };
  }
  if (
    header.length >= 12 &&
    header.toString('ascii', 0, 4) === 'RIFF' &&
    header.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { ext: '.webp', mime: 'image/webp' };
  }
  return null;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(uploadsDir, datedPrefix());
    fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
  },
  filename: (_req, _file, cb) => {
    cb(null, `${crypto.randomBytes(16).toString('hex')}.part`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      const error = new Error('Only image uploads are allowed');
      error.status = 400;
      cb(error);
      return;
    }
    cb(null, true);
  },
});

function storageKeyFromPath(filePath) {
  return path.relative(uploadsDir, filePath).split(path.sep).join('/');
}

function normalizeStorageKey(stored) {
  if (!stored) return null;
  const raw = String(stored).trim().replace(/\\/g, '/');
  if (!raw || raw.includes('\0') || raw.includes('..')) return null;
  const parts = raw.split('/').filter(Boolean);
  if (!parts.length || parts.length > 6) return null;
  if (!parts.every((part) => /^[a-zA-Z0-9._-]+$/.test(part))) return null;
  return parts.join('/');
}

function resolveUploadPath(stored) {
  const key = normalizeStorageKey(stored);
  if (!key) return null;
  const full = path.resolve(uploadsDir, key);
  const root = `${path.resolve(uploadsDir)}${path.sep}`;
  if (!full.startsWith(root)) return null;
  return full;
}

async function pruneEmptyParents(startDir) {
  const root = path.resolve(uploadsDir);
  let current = path.resolve(startDir);
  while (current.startsWith(`${root}${path.sep}`)) {
    let entries;
    try {
      entries = await fsp.readdir(current);
    } catch {
      break;
    }
    if (entries.length > 0) break;
    try {
      await fsp.rmdir(current);
    } catch {
      break;
    }
    current = path.dirname(current);
  }
}

async function unlinkStoredPath(filePath) {
  if (!filePath) return;
  try {
    await fsp.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(err);
    return;
  }
  await pruneEmptyParents(path.dirname(filePath));
}

async function removeStoredFile(stored) {
  await unlinkStoredPath(resolveUploadPath(stored));
}

async function prepareUploadedImage(file) {
  if (!file?.path) {
    const error = new Error('Image file is required');
    error.status = 400;
    throw error;
  }

  return photoWork.run(async () => {
    const header = Buffer.alloc(16);
    const fd = await fsp.open(file.path, 'r');
    let bytes = 0;
    try {
      const result = await fd.read(header, 0, header.length, 0);
      bytes = result.bytesRead;
    } finally {
      await fd.close();
    }

    const sniffed = sniffImage(header.subarray(0, bytes));
    if (!sniffed) {
      await unlinkStoredPath(file.path);
      file.path = null;
      const error = new Error('Only JPEG, PNG, WebP, and GIF images are allowed');
      error.status = 400;
      throw error;
    }

    const plain = await fsp.readFile(file.path);
    const finalPath = `${file.path.slice(0, -'.part'.length)}${sniffed.ext}`;
    await fsp.writeFile(finalPath, encryptPhoto(plain, sniffed.mime));
    await fsp.unlink(file.path);
    file.path = finalPath;
    file.filename = path.basename(finalPath);
    file.mimetype = sniffed.mime;
    file.storageKey = storageKeyFromPath(finalPath);
    return file.storageKey;
  });
}

async function discardUploadedFile(file) {
  if (!file) return;
  if (file.storageKey) await removeStoredFile(file.storageKey);
  if (file.path) await unlinkStoredPath(file.path);
  file.path = null;
  file.storageKey = null;
}

function mimeFromName(name) {
  const ext = path.extname(String(name || '')).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function extensionForMime(mime) {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/gif') return '.gif';
  if (mime === 'image/webp') return '.webp';
  return '.jpg';
}

/** The saved bytes, decrypted when the file was encrypted at rest. */
async function readStoredPhoto(stored) {
  const filePath = resolveUploadPath(stored);
  if (!filePath) return null;

  return photoWork.run(async () => {
    let bytes;
    try {
      bytes = await fsp.readFile(filePath);
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
    const decrypted = decryptPhoto(bytes);
    if (decrypted) return decrypted;
    return { buffer: bytes, mime: mimeFromName(filePath) };
  });
}

function generateEventCode() {
  return crypto.randomBytes(4).toString('hex');
}

module.exports = {
  upload,
  uploadsDir,
  prepareUploadedImage,
  discardUploadedFile,
  resolveUploadPath,
  removeStoredFile,
  readStoredPhoto,
  extensionForMime,
  isEncryptedPhoto,
  sniffImage,
  generateEventCode,
};
