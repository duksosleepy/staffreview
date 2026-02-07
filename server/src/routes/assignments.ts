import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../lib/env.js';
import { authMiddleware } from '../middleware/auth.js';

// GET /api/assignments/by-cht
// Returns all active assignments made by the logged-in CHT, grouped by item.
// Response shape: { [checklist_item_id]: string[] (employee_ids) }

// POST /api/assignments/upsert
// Body: { checklist_item_id, employee_ids: string[] }
// Replaces the full set of employees for that item (idempotent).
// Only CHT can call this.

const UpsertAssignmentsSchema = z.object({
  checklist_item_id: z.string().uuid(),
  employee_ids: z.array(z.string()).min(0), // empty array = clear all assignments for this item
});

export const assignmentRoutes = new Hono<Env>()
  .use('*', authMiddleware)

  /**
   * GET /api/assignments/by-cht
   * Returns assignments created by the current CHT user.
   * Shape: { [item_id: string]: string[] }  — item_id → list of employee_ids
   *
   * NOTE: TaskAssignment type has been removed. Tasks are now automatically assigned
   * based on shift matching (DetailChecklistItem.task_type vs EmployeeSchedule.daily_schedule).
   * This endpoint returns empty object for backwards compatibility.
   */
  .get('/by-cht', async (c) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (user.role !== 'cht') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Return empty object since TaskAssignment no longer exists
    // Tasks are now automatically assigned based on shift matching
    return c.json({});
  })

  /**
   * POST /api/assignments/upsert
   * NOTE: This endpoint is deprecated. TaskAssignment type has been removed.
   * Tasks are now automatically assigned based on shift matching
   * (DetailChecklistItem.task_type vs EmployeeSchedule.daily_schedule).
   * Returns success for backwards compatibility.
   */
  .post('/upsert', zValidator('json', UpsertAssignmentsSchema), async (c) => {
    const user = c.get('user');
    const log = c.get('log');

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (user.role !== 'cht') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    log?.info('Assignment upsert called but is deprecated - automatic shift matching is used');
    return c.json({ success: true });
  });
