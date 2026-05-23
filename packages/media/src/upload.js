'use strict';

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');
const { resolveMediaDir, ensureDirs, getUrl } = require('./media');

function getSubdir(mimetype) {
  if (mimetype.startsWith('image/')) return 'images';
  if (mimetype.startsWith('video/')) return 'videos';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'images';
}

function getAssetType(mimetype) {
  const prefix = mimetype.split('/')[0];
  return ['image', 'video', 'audio'].includes(prefix) ? prefix : 'image';
}

async function generateImageThumb(srcPath, thumbPath) {
  await sharp(srcPath)
    .resize(320, 180, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(thumbPath);
}

function generateVideoThumb(srcPath, thumbPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(srcPath)
      .inputOption('-ss 00:00:01')
      .outputOptions(['-vframes', '1'])
      .size('320x180')
      .output(thumbPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

function getVideoDuration(srcPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(srcPath, (err, meta) => {
      resolve(err ? null : (meta?.format?.duration ?? null));
    });
  });
}

// Returns the asset data object ready for db.assets.create().
// Does NOT write to the database — the caller owns that step.
async function processUpload({ originalname, mimetype, path: tmpPath, size }) {
  const mediaDir = ensureDirs();
  const subdir   = getSubdir(mimetype);
  const ext      = path.extname(originalname) || '';
  const id       = uuidv4();
  const filename = `${id}${ext}`;
  const destPath = path.join(mediaDir, subdir, filename);

  fs.copyFileSync(tmpPath, destPath);
  try { fs.unlinkSync(tmpPath); } catch (_) {}

  const assetUrl = getUrl(`${subdir}/${filename}`);
  let thumbnailPath = null;
  let thumbnailUrl  = null;
  let duration      = null;

  const thumbFilename = `${id}.jpg`;
  const thumbAbsPath  = path.join(mediaDir, 'thumbs', thumbFilename);

  if (mimetype.startsWith('image/')) {
    try {
      await generateImageThumb(destPath, thumbAbsPath);
      thumbnailPath = thumbAbsPath;
      thumbnailUrl  = getUrl(`thumbs/${thumbFilename}`);
    } catch (err) {
      console.warn('[media] image thumbnail failed:', err.message);
    }
  } else if (mimetype.startsWith('video/')) {
    try {
      await generateVideoThumb(destPath, thumbAbsPath);
      thumbnailPath = thumbAbsPath;
      thumbnailUrl  = getUrl(`thumbs/${thumbFilename}`);
    } catch (err) {
      console.warn('[media] video thumbnail failed (is ffmpeg installed?):', err.message);
    }
    duration = await getVideoDuration(destPath);
  }

  return {
    name: originalname,
    type: getAssetType(mimetype),
    path: destPath,
    url: assetUrl,
    size,
    duration,
    thumbnailPath,
    thumbnailUrl,
    tags: [],
  };
}

module.exports = { processUpload };
