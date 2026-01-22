import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { LocalDate } from "gel";
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

// Request body validation for upsert
const UpsertChecklistRecordSchema = z.object({
  checklist_item_id: z.string().uuid(),
  assessment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  employee_checked: z.boolean().optional(),
  cht_checked: z.boolean().optional(),
  asm_checked: z.boolean().optional(),
});

/**
 * Build staff_id filter parameters based on user role
 * - Employee: can only see their own records
 * - CHT: can see all records (they review employees)
 * - ASM: can see all records (they review everyone)
 */
function buildStaffFilter(user: AuthUser) {
  if (user.role === "employee") {
    // Employee can only see records where staff_id matches their sub
    return {
      filterCondition: "and .staff_id = <str>$staffId",
      params: { staffId: user.sub }
    };
  }
  // CHT and ASM can see all records
  return {
    filterCondition: "",
    params: {}
  };
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

    const { filterCondition, params } = buildStaffFilter(user);

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
                ${filterCondition}
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
                ${filterCondition}
              order by .assessment_date desc
              limit 1
            ))
          }
          filter .is_deleted = false
          order by .checklist.name then .order
        `;

    const result = date
      ? await db.query(query, { ...params, date: new LocalDate(
          Number.parseInt(date.split("-")[0], 10),
          Number.parseInt(date.split("-")[1], 10),
          Number.parseInt(date.split("-")[2], 10)
        ) })
      : await db.query(query, params);

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
    const { filterCondition, params } = user.role === "employee"
      ? {
          filterCondition: "and ChecklistRecord.staff_id = <str>$staffId",
          params: { staffId: user.sub }
        }
      : {
          filterCondition: "",
          params: {}
        };

    const query = `
      select array_agg(distinct (
        select ChecklistRecord.assessment_date
        filter ChecklistRecord.is_deleted = false
          ${filterCondition}
      ))
    `;

    const result: string[][] = await db.query(query, params);
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

    const { filterCondition, params: staffParams } = buildStaffFilter(user);

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
            ${filterCondition}
          limit 1
        ))
      }
      filter .is_deleted = false
      order by .category.order then .order then .item_number
    `;

    const result = await db.query(query, {
      month: targetMonth,
      year: targetYear,
      ...staffParams,
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
  })

  /**
   * POST /api/checklist/records/upsert
   * Create or update a ChecklistRecord for the current user
   * Uses INSERT ... UNLESS CONFLICT to handle upsert
   */
  .post("/records/upsert", zValidator("json", UpsertChecklistRecordSchema), async (c) => {
    const body = c.req.valid("json");
    const db = c.get("db");
    const user = c.get("user");
    const log = c.get("log");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Role-based permission check for checkbox fields
    // - Employee: can only set employee_checked
    // - CHT: can set employee_checked and cht_checked
    // - ASM: can set all checkboxes
    const allowedFields: string[] = ["employee_checked"];
    if (user.role === "cht" || user.role === "asm") {
      allowedFields.push("cht_checked");
    }
    if (user.role === "asm") {
      allowedFields.push("asm_checked");
    }

    // Build the SET clause for fields that are provided and allowed
    const setClauses: string[] = [];
    const params: Record<string, unknown> = {
      checklistItemId: body.checklist_item_id,
      staffId: user.sub,
      assessmentDate: new LocalDate(
        Number.parseInt(body.assessment_date.split("-")[0], 10),
        Number.parseInt(body.assessment_date.split("-")[1], 10),
        Number.parseInt(body.assessment_date.split("-")[2], 10)
      ),
    };

    if (body.employee_checked !== undefined && allowedFields.includes("employee_checked")) {
      setClauses.push("employee_checked := <bool>$employeeChecked");
      params.employeeChecked = body.employee_checked;
    }
    if (body.cht_checked !== undefined && allowedFields.includes("cht_checked")) {
      setClauses.push("cht_checked := <bool>$chtChecked");
      params.chtChecked = body.cht_checked;
    }
    if (body.asm_checked !== undefined && allowedFields.includes("asm_checked")) {
      setClauses.push("asm_checked := <bool>$asmChecked");
      params.asmChecked = body.asm_checked;
    }

    // Always update the updated_at timestamp
    setClauses.push("updated_at := datetime_current()");

    // Build INSERT fields dynamically
    const insertFields: string[] = [];
    if (body.employee_checked !== undefined && allowedFields.includes("employee_checked")) {
      insertFields.push("employee_checked := <bool>$employeeChecked");
    }
    if (body.cht_checked !== undefined && allowedFields.includes("cht_checked")) {
      insertFields.push("cht_checked := <bool>$chtChecked");
    }
    if (body.asm_checked !== undefined && allowedFields.includes("asm_checked")) {
      insertFields.push("asm_checked := <bool>$asmChecked");
    }

    // Use INSERT ... UNLESS CONFLICT for upsert
    const query = `
      with
        item := (select ChecklistItem filter .id = <uuid>$checklistItemId),
      insert ChecklistRecord {
        checklist_item := item,
        staff_id := <str>$staffId,
        assessment_date := <cal::local_date>$assessmentDate${insertFields.length > 0 ? ",\n        " + insertFields.join(",\n        ") : ""},
        created_at := datetime_current(),
        updated_at := datetime_current()
      }
      unless conflict on ((.checklist_item, .staff_id, .assessment_date))
      else (
        update ChecklistRecord
        set {
          ${setClauses.join(",\n          ")}
        }
      )
    `;

    try {
      const result = await db.query(query, params);
      return c.json({ success: true, data: result });
    } catch (error) {
      log?.error({ error, params }, "Failed to upsert checklist record");
      return c.json({ error: "Failed to save record" }, 500);
    }
  });
