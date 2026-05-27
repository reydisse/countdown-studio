'use strict';

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

let _client = null;

function getClient() {
  if (_client) return _client;
  _client = new S3Client({
    endpoint:    `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region:      'auto',
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

async function uploadToR2(buffer, key, contentType) {
  await getClient().send(new PutObjectCommand({
    Bucket:      process.env.R2_BUCKET_NAME,
    Key:         key,
    Body:        buffer,
    ContentType: contentType,
  }));
  return getR2Url(key);
}

async function deleteFromR2(key) {
  await getClient().send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key:    key,
  }));
}

function getR2Url(key) {
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

module.exports = { uploadToR2, deleteFromR2, getR2Url };
