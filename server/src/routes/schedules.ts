import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../lib/env.js';
import { authMiddleware } from '../middleware/auth.js';

// GET /api/schedules/by-store
// Returns all employee schedules for the CHT's store
// Response: Array<{ employee_id: string, daily_schedule: string[] }>

// POST /api/schedules/upsert
// Body: { employee_id, daily_schedule: string[] }
// Upserts the employee's schedule (31 strings for N1-N31)
// Only CHT can call this.

const UpsertScheduleSchema = z.object({
  employee_id: z.string(),
  daily_schedule: z
    .array(
      z.string().refine(
        (val) => val === '' || val === 'S' || val === 'C' || val === 'F',
        { message: 'Schedule values must be empty string, S, C, or F' }
      )
    )
    .length(31), // Exactly 31 elements for N1-N31
});

export const scheduleRoutes = new Hono<Env>()
  .use('*', authMiddleware)

  /**
   * GET /api/schedules/by-store
   * Returns all employee schedules for the CHT's store.
   * Only accessible by CHT role.
   */
  .get('/by-store', async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    const log = c.get('log');

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (user.role !== 'cht') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const storeId = user.stores[0] ?? '';

    try {
      const query = `
        select EmployeeSchedule {
          employee_id,
          daily_schedule
        }
        filter .store_id = <str>$storeId
          and .is_deleted = false
      `;

      const schedules = await db.query<{
        employee_id: string;
        daily_schedule: string[];
      }>(query, { storeId });

      log?.info({ storeId, count: schedules.length }, 'Employee schedules fetched');
      return c.json(schedules);
    } catch (error) {
      log?.error({ error }, 'Failed to fetch employee schedules');
      return c.json({ error: 'Failed to fetch schedules' }, 500);
    }
  })

  /**
   * POST /api/schedules/upsert
   * Upserts an employee's schedule (creates or updates).
   * Only CHT role is allowed.
   */
  .post('/upsert', zValidator('json', UpsertScheduleSchema), async (c) => {
    const { employee_id, daily_schedule } = c.req.valid('json');
    const db = c.get('db');
    const user = c.get('user');
    const log = c.get('log');

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (user.role !== 'cht') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const storeId = user.stores[0] ?? '';

    try {
      // Check if schedule exists for this employee
      const existingQuery = `
        select EmployeeSchedule {
          id
        }
        filter .employee_id = <str>$employeeId
          and .is_deleted = false
        limit 1
      `;

      const existing = await db.query<{ id: string }>(existingQuery, {
        employeeId: employee_id,
      });

      if (existing.length > 0) {
        // Update existing schedule
        const updateQuery = `
          update EmployeeSchedule
          filter .employee_id = <str>$employeeId
            and .is_deleted = false
          set {
            daily_schedule := <array<str>>$dailySchedule,
            updated_at := datetime_current()
          }
        `;

        await db.query(updateQuery, {
          employeeId: employee_id,
          dailySchedule: daily_schedule,
        });

        log?.info({ employeeId: employee_id }, 'Employee schedule updated');
      } else {
        // Insert new schedule
        const insertQuery = `
          insert EmployeeSchedule {
            employee_id := <str>$employeeId,
            store_id := <str>$storeId,
            daily_schedule := <array<str>>$dailySchedule,
            created_at := datetime_current(),
            updated_at := datetime_current()
          }
        `;

        await db.query(insertQuery, {
          employeeId: employee_id,
          storeId,
          dailySchedule: daily_schedule,
        });

        log?.info({ employeeId: employee_id }, 'Employee schedule created');
      }

      return c.json({ success: true });
    } catch (error) {
      log?.error({ error }, 'Failed to upsert employee schedule');
      return c.json({ error: 'Failed to save schedule' }, 500);
    }
  });
