'use strict';

const isProd = process.env.NODE_ENV === 'production';

const LEVELS = { info: 'INFO', warn: 'WARN', error: 'ERRO' };
const COLORS = { info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' };
const RESET  = '\x1b[0m';

function log(level, msg, meta = {}) {
  const now = new Date().toISOString();
  if (isProd) {
    process.stdout.write(JSON.stringify({ time: now, level, msg, ...meta }) + '\n');
  } else {
    const color  = COLORS[level] ?? '';
    const label  = LEVELS[level] ?? level.toUpperCase();
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    process.stdout.write(`${color}${label}${RESET} [${now.slice(11, 23)}] ${msg}${metaStr}\n`);
  }
}

module.exports = {
  info:  (msg, meta) => log('info',  msg, meta),
  warn:  (msg, meta) => log('warn',  msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};
