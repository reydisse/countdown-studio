'use strict'

const isDev = process.env.NODE_ENV === 'development'

module.exports = {
  isDev,
  CF_API_URL: isDev ? 'http://localhost:9876' : (process.env.CF_API_URL || 'https://showstackapi.faithfireproduction.com'),
  CF_WS_URL:  isDev ? 'ws://localhost:9876'   : (process.env.CF_WS_URL  || 'wss://showstackapi.faithfireproduction.com'),
}
