import { Hono } from 'hono';
import type { Env } from '../lib/env.js';
import { assignmentRoutes } from './assignments.js';
import { checklistRoutes } from './checklist.js';
import { employeeRoutes } from './employees.js';
import { healthRoutes } from './health.js';
import { scheduleRoutes } from './schedules.js';

// Compose all API routes
// NOTE: Raw /query endpoint removed for security - use specific endpoints instead
export const apiRoutes = new Hono<Env>()
  .route('/checklist', checklistRoutes)
  .route('/employees', employeeRoutes)
  .route('/assignments', assignmentRoutes)
  .route('/schedules', scheduleRoutes)
  .route('/health', healthRoutes);
