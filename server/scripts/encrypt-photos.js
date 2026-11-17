// Rewrites saved photos in place so the files on disk are encrypted.
// Already encrypted files are left alone. The database keeps the same file name.
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { uploadsDir, sniffImage } = require('../src/utils/upload');
const { encryptPhoto, isEncryptedPhoto } = require('../src/utils/photoCipher');

function walk(dir, found = []) {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (entry.isFile()) found.push(full);
  }
  return found;
}

function main() {
  const files = walk(uploadsDir);
  let encrypted = 0;
  let skipped = 0;
  for (const filePath of files) {
    const bytes = fs.readFileSync(filePath);
    if (isEncryptedPhoto(bytes)) {
      skipped += 1;
      continue;
    }
    const sniffed = sniffImage(bytes.subarray(0, 16));
    if (!sniffed) {
      skipped += 1;
      continue;
    }
    const tmp = `${filePath}.enc-tmp`;
    fs.writeFileSync(tmp, encryptPhoto(bytes, sniffed.mime));
    fs.renameSync(tmp, filePath);
    encrypted += 1;
  }
  console.log(`Encrypted ${encrypted} photo(s). Left ${skipped} file(s) unchanged.`);
}

main();
