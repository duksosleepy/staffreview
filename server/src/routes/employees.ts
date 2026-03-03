import { Hono } from 'hono';
import type { Env } from '../lib/env.js';
import { fetchCasdoorUsersByStores } from '../lib/oidc.js';
import { authMiddleware } from '../middleware/auth.js';

export const employeeRoutes = new Hono<Env>()
  .use('*', authMiddleware)

  /**
   * GET /api/employees/by-store
   * List employees that share the same store(s) as the logged-in CHT/ASM user.
   * Only accessible by CHT and ASM roles.
   */
  .get('/by-store', async (c) => {
    const user = c.get('user');
    const log = c.get('log');
    const db = c.get('db');

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Only CHT and ASM can list store employees
    if (user.role === 'employee') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    if (!user.stores.length) {
      return c.json([]);
    }

    try {
      // Log requester role for debugging
      log?.info({ requesterRole: user.role, stores: user.stores }, 'Fetching store employees');

      // Fetch Casdoor users
      const casdoorEmployees = await fetchCasdoorUsersByStores(user.stores, user.role);

      // Fetch imported employees from EmployeeSchedule (those not in Casdoor yet)
      const schedules = await db.query<{
        hr_id: string;
        employee_name: string;
        store_id: string;
        region: string;
        position: string;
        daily_schedule: string[];
      }>(
        `
        select EmployeeSchedule {
          hr_id,
          employee_name,
          store_id,
          region,
          position,
          daily_schedule
        }
        filter .store_id in array_unpack(<array<str>>$storeIds)
          and .is_deleted = false
      `,
        { storeIds: user.stores },
      );

      // Create a map of hr_id -> casdoor employee for matching
      const casdoorByHrId = new Map(casdoorEmployees.filter((e) => e.casdoor_id).map((e) => [e.casdoor_id, e]));

      // Merge: add imported employees that don't have Casdoor accounts
      const importedOnly = schedules
        .filter((schedule) => !casdoorByHrId.has(schedule.hr_id))
        .map((schedule) => ({
          id: schedule.hr_id, // Use hr_id as the ID for imported employees
          name: schedule.hr_id,
          displayName: schedule.employee_name,
          email: '',
          stores: [schedule.store_id],
          casdoor_id: schedule.hr_id,
          role: 'employee',
          department: schedule.store_id,
          region: schedule.region,
          hr_id: schedule.hr_id,
          position: schedule.position,
          daily_schedule: schedule.daily_schedule,
        }));

      // Enrich Casdoor employees with schedule data if available
      const enrichedCasdoorEmployees = casdoorEmployees.map((emp) => {
        if (emp.casdoor_id) {
          const schedule = schedules.find((s) => s.hr_id === emp.casdoor_id);
          if (schedule) {
            return {
              ...emp,
              department: schedule.store_id,
              region: schedule.region,
              hr_id: schedule.hr_id,
              position: schedule.position,
              daily_schedule: schedule.daily_schedule,
            };
          }
        }
        return emp;
      });

      // Combine both lists
      const allEmployees = [...enrichedCasdoorEmployees, ...importedOnly];

      // Log result for debugging
      log?.info(
        {
          requesterRole: user.role,
          casdoorCount: casdoorEmployees.length,
          importedOnlyCount: importedOnly.length,
          totalCount: allEmployees.length,
        },
        'Store employees fetched (Casdoor + imported)',
      );

      return c.json(allEmployees);
    } catch (error) {
      log?.error({ error }, 'Failed to fetch store employees');
      return c.json({ error: 'Failed to fetch employees' }, 500);
    }
  });
