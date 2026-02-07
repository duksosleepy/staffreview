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
  hr_id: z.string(), // ID HRM - Primary identifier
  employee_name: z.string(), // HỌ VÀ TÊN (dấu)
  store_id: z.string(), // Mã bộ phận - Department/Store code from Excel
  daily_schedule: z.array(z.string()).length(31), // Exactly 31 elements for N1-N31
  region: z.string().optional(), // Miền
  position: z.string().optional(), // Mã chức vụ
  status: z.string().optional(), // TRẠNG THÁI NHÂN VIÊN
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
          hr_id,
          employee_name,
          daily_schedule,
          region,
          position,
          status
        }
        filter .store_id = <str>$storeId
          and .is_deleted = false
      `;

      const schedules = await db.query<{
        hr_id: string;
        employee_name: string;
        daily_schedule: string[];
        region?: string;
        position?: string;
        status?: string;
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
    const { hr_id, employee_name, store_id, daily_schedule, region, position, status } = c.req.valid('json');
    const db = c.get('db');
    const user = c.get('user');
    const log = c.get('log');

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (user.role !== 'cht') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const storeId = store_id; // Use store_id from Excel file

    try {
      // Check if schedule exists for this employee (by hr_id and store_id)
      const existingQuery = `
        select EmployeeSchedule {
          id
        }
        filter .hr_id = <str>$hrId
          and .store_id = <str>$storeId
          and .is_deleted = false
        limit 1
      `;

      const existing = await db.query<{ id: string }>(existingQuery, {
        hrId: hr_id,
        storeId,
      });

      if (existing.length > 0) {
        // Update existing schedule
        const updateQuery = `
          update EmployeeSchedule
          filter .hr_id = <str>$hrId
            and .store_id = <str>$storeId
            and .is_deleted = false
          set {
            employee_name := <str>$employeeName,
            daily_schedule := <array<str>>$dailySchedule,
            region := <optional str>$region,
            position := <optional str>$position,
            status := <optional str>$status,
            updated_at := datetime_current()
          }
        `;

        await db.query(updateQuery, {
          hrId: hr_id,
          storeId,
          employeeName: employee_name,
          dailySchedule: daily_schedule,
          region: region ?? null,
          position: position ?? null,
          status: status ?? null,
        });

        log?.info({ hrId: hr_id, name: employee_name }, 'Employee schedule updated');
      } else {
        // Insert new schedule
        const insertQuery = `
          insert EmployeeSchedule {
            hr_id := <str>$hrId,
            employee_name := <str>$employeeName,
            store_id := <str>$storeId,
            daily_schedule := <array<str>>$dailySchedule,
            region := <optional str>$region,
            position := <optional str>$position,
            status := <optional str>$status,
            created_at := datetime_current(),
            updated_at := datetime_current()
          }
        `;

        await db.query(insertQuery, {
          hrId: hr_id,
          employeeName: employee_name,
          storeId,
          dailySchedule: daily_schedule,
          region: region ?? null,
          position: position ?? null,
          status: status ?? null,
        });

        log?.info({ hrId: hr_id, name: employee_name }, 'Employee schedule created');
      }

      return c.json({ success: true });
    } catch (error) {
      log?.error({ error, errorMessage: error instanceof Error ? error.message : String(error) }, 'Failed to upsert employee schedule');
      return c.json({
        error: 'Failed to save schedule',
        details: error instanceof Error ? error.message : String(error)
      }, 500);
    }
  });
