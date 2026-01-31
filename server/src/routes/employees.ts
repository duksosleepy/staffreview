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

      const employees = await fetchCasdoorUsersByStores(user.stores, user.role);

      // Log result for debugging
      log?.info({
        requesterRole: user.role,
        employeeCount: employees.length,
        roles: employees.map(e => e.role)
      }, 'Store employees fetched');

      return c.json(employees);
    } catch (error) {
      log?.error({ error }, 'Failed to fetch store employees from Casdoor');
      return c.json({ error: 'Failed to fetch employees' }, 500);
    }
  });
