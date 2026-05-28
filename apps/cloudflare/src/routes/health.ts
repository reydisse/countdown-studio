import { Hono } from 'hono'
import type { Bindings } from '../types.js'

const health = new Hono<{ Bindings: Bindings }>()

health.get('/', (c) => c.json({
  status: 'ok',
  uptime: Date.now(),
  environment: c.env.ENVIRONMENT ?? 'unknown',
}))

export default health
