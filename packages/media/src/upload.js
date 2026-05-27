'use strict';

const path  = require('path');
const fs    = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { resolveMediaDir, ensureDirs } = require('./media');

const USE_R2 = !!process.env.R2_ACCOUNT_ID;

if (USE_R2) {
  console.log('[media] Using R2 storage');
} else {
  console.log('[media] Using local storage');
}

function getAssetType(mimetype) {
  const prefix = mimetype.split('/')[0];
  return ['image', 'video', 'audio'].includes(prefix) ? prefix : 'image';
}

function getSubdir(mimetype) {
  if (mimetype.startsWith('image/')) return 'images';
  if (mimetype.startsWith('video/')) return 'videos';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'images';
}

// Expects multer memoryStorage — req.file has `buffer`, not `path`.
// roomCode scopes storage keys / directory paths.
async function processUpload({ buffer, originalname, mimetype, size }, roomCode) {
  const type    = getAssetType(mimetype);
  const subdir  = getSubdir(mimetype);
  const id      = uuidv4();
  const ext     = path.extname(originalname) || '';
  const filename = `${id}${ext}`;
  const key     = `rooms/${roomCode}/${subdir}/${filename}`;

  let url;
  let thumbnailUrl = null;

  if (USE_R2) {
    const { uploadToR2 } = require('./r2');
    url = await uploadToR2(buffer, key, mimetype);

    if (mimetype.startsWith('image/')) {
      try {
        const thumbBuffer = await sharp(buffer)
          .resize(320, 180, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
        const thumbKey = `rooms/${roomCode}/thumbs/${id}.jpg`;
        thumbnailUrl   = await uploadToR2(thumbBuffer, thumbKey, 'image/jpeg');
      } catch (err) {
        console.warn('[media] R2 thumbnail failed:', err.message);
      }
    }
  } else {
    ensureDirs();
    const mediaDir   = resolveMediaDir();
    const roomSubDir = path.join(mediaDir, 'rooms', roomCode, subdir);
    fs.mkdirSync(roomSubDir, { recursive: true });
    fs.writeFileSync(path.join(roomSubDir, filename), buffer);
    url = `/media/rooms/${roomCode}/${subdir}/${filename}`;

    if (mimetype.startsWith('image/')) {
      try {
        const thumbDir = path.join(mediaDir, 'rooms', roomCode, 'thumbs');
        fs.mkdirSync(thumbDir, { recursive: true });
        await sharp(buffer)
          .resize(320, 180, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(path.join(thumbDir, `${id}.jpg`));
        thumbnailUrl = `/media/rooms/${roomCode}/thumbs/${id}.jpg`;
      } catch (err) {
        console.warn('[media] local thumbnail failed:', err.message);
      }
    }
  }

  return { name: originalname, type, url, size, duration: null, thumbnailUrl, tags: [] };
}

async function deleteMedia(url, thumbnailUrl) {
  if (USE_R2) {
    const { deleteFromR2 } = require('./r2');
    const base = `${process.env.R2_PUBLIC_URL}/`;
    if (url?.startsWith(base))          await deleteFromR2(url.slice(base.length)).catch(() => {});
    if (thumbnailUrl?.startsWith(base)) await deleteFromR2(thumbnailUrl.slice(base.length)).catch(() => {});
  } else {
    const mediaDir = resolveMediaDir();
    function unlink(u) {
      if (!u?.startsWith('/media/')) return;
      fs.unlink(path.join(mediaDir, u.slice('/media/'.length)), () => {});
    }
    unlink(url);
    unlink(thumbnailUrl);
  }
}

module.exports = { processUpload, deleteMedia };
