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

// Request body validation for upsert (Sheet 1 - approval workflow)
const UpsertChecklistRecordSchema = z.object({
  checklist_item_id: z.string().uuid(),
  assessment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  employee_checked: z.boolean().optional(),
  cht_checked: z.boolean().optional(),
  asm_checked: z.boolean().optional(),
});

// Request body validation for upsert (Sheet 2 - monthly tracking)
const UpsertDetailMonthlyRecordSchema = z.object({
  detail_item_id: z.string().uuid(),
  month: z.number().min(1).max(12),
  year: z.number().min(2020),
  day: z.number().min(1).max(31),
  checked: z.boolean(),
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
   * Fetch checklist items (from DetailChecklistItem) with Sheet 1 approval records
   * Both Sheet 1 and Sheet 2 now share the same checklist items
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

    // Now using DetailChecklistItem as the source of truth for both sheets
    // Sheet 1 uses checklist_records backlink for approval workflow
    const query = date
      ? `
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
              select .checklist_records {
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
          order by .category.order then .order then .item_number
        `
      : `
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
              select .checklist_records {
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
          order by .category.order then .order then .item_number
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
   * Fetch available assessment dates from Sheet 1 records, filtered by user role
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
   * Fetch detail checklist items with Sheet 2 monthly records, filtered by user role
   * Both sheets share the same items, but Sheet 2 uses monthly_records backlink
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

    // Sheet 2 uses monthly_records backlink for monthly tracking
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
          select .monthly_records {
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
   * Create or update a ChecklistRecord (Sheet 1 approval workflow) for the current user
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
    // Now using DetailChecklistItem instead of ChecklistItem
    const query = `
      with
        item := (select DetailChecklistItem filter .id = <uuid>$checklistItemId),
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
  })

  /**
   * POST /api/checklist/detail-records/upsert
   * Create or update a DetailMonthlyRecord (Sheet 2 monthly tracking) for the current user
   * Uses INSERT ... UNLESS CONFLICT to handle upsert
   */
  .post("/detail-records/upsert", zValidator("json", UpsertDetailMonthlyRecordSchema), async (c) => {
    const body = c.req.valid("json");
    const db = c.get("db");
    const user = c.get("user");
    const log = c.get("log");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    log?.debug({ userId: user.sub, body }, "Upserting detail monthly record");

    const params: Record<string, unknown> = {
      detailItemId: body.detail_item_id,
      staffId: user.sub,
      month: body.month,
      year: body.year,
      day: body.day,
      checked: body.checked,
    };

    // Use INSERT ... UNLESS CONFLICT for upsert
    // Update the specific day in the daily_checks array
    const query = `
      with
        item := (select DetailChecklistItem filter .id = <uuid>$detailItemId),
        existing := (
          select DetailMonthlyRecord
          filter .detail_item = item
            and .staff_id = <str>$staffId
            and .month = <int32>$month
            and .year = <int32>$year
          limit 1
        ),
        # Create initial array with 31 false values if needed
        initial_checks := array_agg((
          for i in range_unpack(range(0, 31))
          union (
            select false
          )
        )),
        # Get current checks or use initial
        current_checks := existing.daily_checks ?? initial_checks,
        # Update the specific day (0-indexed, so day-1)
        updated_checks := (
          select array_agg((
            for idx in range_unpack(range(0, 31))
            union (
              select (
                if idx = (<int32>$day - 1)
                then <bool>$checked
                else current_checks[idx] ?? false
              )
            )
          ))
        )
      insert DetailMonthlyRecord {
        detail_item := item,
        staff_id := <str>$staffId,
        month := <int32>$month,
        year := <int32>$year,
        daily_checks := updated_checks,
        created_at := datetime_current(),
        updated_at := datetime_current()
      }
      unless conflict on ((.detail_item, .staff_id, .month, .year))
      else (
        update DetailMonthlyRecord
        set {
          daily_checks := updated_checks,
          updated_at := datetime_current()
        }
      )
    `;

    try {
      const result = await db.query(query, params);
      return c.json({ success: true, data: result });
    } catch (error) {
      log?.error({ error, params }, "Failed to upsert detail monthly record");
      return c.json({ error: "Failed to save record" }, 500);
    }
  });
