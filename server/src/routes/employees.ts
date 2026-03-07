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
      log?.info({ userStores: user.stores }, 'Current user stores from JWT');
      const casdoorEmployees = await fetchCasdoorUsersByStores(user.stores, user.role);
      log?.info({ casdoorEmployeesCount: casdoorEmployees.length }, 'Casdoor employees fetched');

      // Fetch all Area records and build a mapping from individual store_id to region
      // Note: Area.store_id can contain comma-separated values like "LUG_THD,LUG_KDV,LUG_ABC"
      const areas = await db.query<{ store_id: string; region: string }>(`select Area { store_id, region }`);

      const regionByStoreId = new Map<string, string>();
      for (const area of areas) {
        // Split comma-separated store_ids and map each one to the region
        const storeIdList = area.store_id.split(',').map((id) => id.trim());
        for (const storeId of storeIdList) {
          if (storeId) {
            regionByStoreId.set(storeId, area.region);
          }
        }
      }

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
          region: regionByStoreId.get(schedule.store_id) || schedule.region || '',
          hr_id: schedule.hr_id,
          position: schedule.position,
          daily_schedule: schedule.daily_schedule,
        }));

      // Enrich Casdoor employees with schedule data if available
      const enrichedCasdoorEmployees = casdoorEmployees.map((emp) => {
        if (emp.casdoor_id) {
          const schedule = schedules.find((s) => s.hr_id === emp.casdoor_id);
          if (schedule) {
            // Get region from Area table first, fallback to EmployeeSchedule.region
            const region = regionByStoreId.get(schedule.store_id) || schedule.region || '';
            return {
              ...emp,
              department: schedule.store_id,
              region,
              hr_id: schedule.hr_id,
              position: schedule.position,
              daily_schedule: schedule.daily_schedule,
            };
          }
        }
        // For employees without schedule, try to get region from their first store
        if (emp.stores && emp.stores.length > 0) {
          const region = regionByStoreId.get(emp.stores[0]);
          if (region) {
            return { ...emp, region };
          }
        }
        return emp;
      });

      // Combine both lists
      const allEmployees = [...enrichedCasdoorEmployees, ...importedOnly];

      // Log result for debugging with store breakdown
      const storeBreakdown = new Map<string, number>();
      for (const emp of allEmployees) {
        for (const store of emp.stores) {
          storeBreakdown.set(store, (storeBreakdown.get(store) || 0) + 1);
        }
      }

      log?.info(
        {
          requesterRole: user.role,
          casdoorCount: casdoorEmployees.length,
          importedOnlyCount: importedOnly.length,
          totalCount: allEmployees.length,
          storeBreakdown: Object.fromEntries(storeBreakdown),
          regions: [...new Set(allEmployees.map(e => (e as any).region).filter(Boolean))],
        },
        'Store employees fetched (Casdoor + imported)',
      );

      return c.json(allEmployees);
    } catch (error) {
      log?.error({ error }, 'Failed to fetch store employees');
      return c.json({ error: 'Failed to fetch employees' }, 500);
    }
  });
