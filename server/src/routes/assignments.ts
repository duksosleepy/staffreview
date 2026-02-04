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
   */
  .get('/by-cht', async (c) => {
    const db = c.get('db');
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (user.role !== 'cht') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const query = `
      select TaskAssignment {
        checklist_item: { id },
        employee_id
      }
      filter .cht_id = <str>$chtId
        and .is_deleted = false
    `;

    const rows = await db.query<{ checklist_item: { id: string }; employee_id: string }>(query, {
      chtId: user.sub,
    });

    // Group by item id
    const grouped: Record<string, string[]> = {};
    for (const row of rows) {
      const itemId = row.checklist_item.id;
      if (!grouped[itemId]) {
        grouped[itemId] = [];
      }
      grouped[itemId].push(row.employee_id);
    }

    return c.json(grouped);
  })

  /**
   * POST /api/assignments/upsert
   * Replaces the full employee list for a single checklist item.
   * - Soft-deletes any existing assignments for this (item, cht) that are NOT in the new list.
   * - Inserts new assignments for employees that don't have one yet.
   * Only CHT role is allowed.
   */
  .post('/upsert', zValidator('json', UpsertAssignmentsSchema), async (c) => {
    const { checklist_item_id, employee_ids } = c.req.valid('json');
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
      // 1. Soft-delete ALL current assignments for this (item, cht)
      const deleteQuery = `
        update TaskAssignment
        filter .checklist_item.id = <uuid>$itemId
          and .cht_id = <str>$chtId
          and .is_deleted = false
        set {
          is_deleted := true,
          deleted_at := datetime_current(),
          updated_at := datetime_current()
        }
      `;
      await db.query(deleteQuery, {
        itemId: checklist_item_id,
        chtId: user.sub,
      });

      // 2. Insert new assignments for each employee_id
      if (employee_ids.length > 0) {
        const insertQuery = `
          with
            item := (select DetailChecklistItem filter .id = <uuid>$itemId),
          for empId in array_unpack(<array<str>>$employeeIds)
          union (
            insert TaskAssignment {
              checklist_item := item,
              cht_id := <str>$chtId,
              employee_id := empId,
              store_id := <str>$storeId,
              created_at := datetime_current(),
              updated_at := datetime_current()
            }
          )
        `;
        await db.query(insertQuery, {
          itemId: checklist_item_id,
          chtId: user.sub,
          employeeIds: employee_ids,
          storeId,
        });
      }

      log?.info({ itemId: checklist_item_id, employeeCount: employee_ids.length }, 'Assignments upserted');
      return c.json({ success: true });
    } catch (error) {
      log?.error({ error }, 'Failed to upsert assignments');
      return c.json({ error: 'Failed to save assignments' }, 500);
    }
  });
