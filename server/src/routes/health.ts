import { Hono } from 'hono';
import type { Env } from '../lib/env.js';

// Health check routes
export const healthRoutes = new Hono<Env>().get('/', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});
