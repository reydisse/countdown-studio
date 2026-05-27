'use strict';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS  = '0123456789';

function generateRoomCode(db) {
  let code;
  let attempts = 0;
  do {
    if (++attempts > 1000) throw new Error('Unable to generate unique room code');
    const prefix = Array.from({ length: 2 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
    const suffix = Array.from({ length: 4 }, () => DIGITS[Math.floor(Math.random() * DIGITS.length)]).join('');
    code = `${prefix}-${suffix}`;
  } while (db.prepare('SELECT 1 FROM rooms WHERE code = ?').get(code));
  return code;
}

function isValidRoomCode(code) {
  return /^[A-Z]{2}-[0-9]{4}$/.test(code);
}

module.exports = { generateRoomCode, isValidRoomCode };
