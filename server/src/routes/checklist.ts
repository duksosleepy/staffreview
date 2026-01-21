import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../lib/env.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AuthUser } from "../types/auth.js";

// Query params validation
const DateQuerySchema = z.object({
  date: z.string().optional(),
});

const MonthYearQuerySchema = z.object({
  month: z.coerce.number().min(1).max(12).optional(),
  year: z.coerce.number().min(2000).max(2100).optional(),
});

/**
 * Build staff_id filter clause based on user role
 * - Employee: can only see their own records
 * - CHT: can see all records (they review employees)
 * - ASM: can see all records (they review everyone)
 */
function buildStaffFilter(user: AuthUser): string {
  if (user.role === "employee") {
    // Employee can only see records where staff_id matches their sub
    return `and .staff_id = "${user.sub}"`;
  }
  // CHT and ASM can see all records
  return "";
}

export const checklistRoutes = new Hono<Env>()
  // All routes require authentication
  .use("*", authMiddleware)

  /**
   * GET /api/checklist/items
   * Fetch checklist items with records, filtered by user role
   */
  .get("/items", zValidator("query", DateQuerySchema), async (c) => {
    const { date } = c.req.valid("query");
    const db = c.get("db");
    const user = c.get("user");
    const log = c.get("log");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    log?.debug({ userId: user.sub, role: user.role, date }, "Fetching checklist items");

    const staffFilter = buildStaffFilter(user);

    const query = date
      ? `
          select ChecklistItem {
            id,
            name,
            standard_score,
            order,
            checklist: { name },
            record := assert_single((
              select .records {
                id,
                assessment_date,
                employee_checked,
                cht_checked,
                asm_checked,
                achievement_percentage,
                successful_completions,
                implementation_issues,
                score_achieved,
                final_classification,
                staff_id
              }
              filter .is_deleted = false
                and .assessment_date = <cal::local_date>$date
                ${staffFilter}
              limit 1
            ))
          }
          filter .is_deleted = false
          order by .checklist.name then .order
        `
      : `
          select ChecklistItem {
            id,
            name,
            standard_score,
            order,
            checklist: { name },
            record := assert_single((
              select .records {
                id,
                assessment_date,
                employee_checked,
                cht_checked,
                asm_checked,
                achievement_percentage,
                successful_completions,
                implementation_issues,
                score_achieved,
                final_classification,
                staff_id
              }
              filter .is_deleted = false
                ${staffFilter}
              order by .assessment_date desc
              limit 1
            ))
          }
          filter .is_deleted = false
          order by .checklist.name then .order
        `;

    const result = date
      ? await db.query(query, { date })
      : await db.query(query);

    return c.json(result);
  })

  /**
   * GET /api/checklist/assessment-dates
   * Fetch available assessment dates, filtered by user role
   */
  .get("/assessment-dates", async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Build filter for staff_id
    const staffFilter = user.role === "employee"
      ? `and ChecklistRecord.staff_id = "${user.sub}"`
      : "";

    const query = `
      select array_agg(distinct (
        select ChecklistRecord.assessment_date
        filter ChecklistRecord.is_deleted = false
          ${staffFilter}
      ))
    `;

    const result: string[][] = await db.query(query);
    const dates = result[0] ?? [];

    return c.json(dates.sort((a, b) => b.localeCompare(a)));
  })

  /**
   * GET /api/checklist/detail-items
   * Fetch detail checklist items with monthly records, filtered by user role
   */
  .get("/detail-items", zValidator("query", MonthYearQuerySchema), async (c) => {
    const { month, year } = c.req.valid("query");
    const db = c.get("db");
    const user = c.get("user");
    const log = c.get("log");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const currentDate = new Date();
    const targetMonth = month ?? currentDate.getMonth() + 1;
    const targetYear = year ?? currentDate.getFullYear();

    log?.debug(
      { userId: user.sub, role: user.role, month: targetMonth, year: targetYear },
      "Fetching detail checklist items"
    );

    const staffFilter = buildStaffFilter(user);

    const query = `
      select DetailChecklistItem {
        id,
        item_number,
        name,
        evaluator,
        scope,
        time_frame,
        penalty_level_1,
        penalty_level_2,
        penalty_level_3,
        score,
        order,
        notes,
        category: { id, name, category_type },
        record := assert_single((
          select .records {
            id,
            month,
            year,
            daily_checks,
            achievement_percentage,
            successful_completions,
            implementation_issues_count,
            score_achieved,
            classification,
            notes,
            staff_id
          }
          filter .is_deleted = false
            and .month = <int32>$month
            and .year = <int32>$year
            ${staffFilter}
          limit 1
        ))
      }
      filter .is_deleted = false
      order by .category.order then .order then .item_number
    `;

    const result = await db.query(query, {
      month: targetMonth,
      year: targetYear,
    });

    return c.json(result);
  })

  /**
   * GET /api/checklist/categories
   * Fetch detail categories (no user filtering needed - just metadata)
   */
  .get("/categories", async (c) => {
    const db = c.get("db");

    const query = `
      select DetailCategory {
        id,
        name,
        category_type,
        description,
        order
      }
      order by .order
    `;

    const result = await db.query(query);
    return c.json(result);
  });
