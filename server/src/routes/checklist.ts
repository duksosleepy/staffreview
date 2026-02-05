import { zValidator } from '@hono/zod-validator';
import { LocalDate } from 'gel';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../lib/env.js';
import { authMiddleware } from '../middleware/auth.js';
import type { AuthUser } from '../types/auth.js';
import { validateColumnAccess, getAllowedColumns, type ChecklistColumn } from '../lib/rbac.js';

// Query params validation
const DateQuerySchema = z.object({
  date: z.string().optional(),
  staff_id: z.string().optional(),
});

const MonthYearQuerySchema = z.object({
  month: z.coerce.number().min(1).max(12).optional(),
  year: z.coerce.number().min(2000).max(2100).optional(),
  staff_id: z.string().optional(),
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
 * - Employee: can only see their own records (filter by staff_id)
 * - CHT/ASM viewing specific employee: filter by that staff_id
 * - CHT/ASM viewing all: filter by store_id IN stores[]
 */
function buildStaffFilter(user: AuthUser, targetStaffId?: string) {
  if (user.role === 'employee') {
    return {
      filterCondition: 'and .staff_id = <str>$staffId',
      params: { staffId: user.sub },
    };
  }
  // CHT/ASM viewing a specific employee's records
  if (targetStaffId) {
    return {
      filterCondition: 'and .staff_id = <str>$staffId',
      params: { staffId: targetStaffId },
    };
  }
  // CHT and ASM: filter by store_id matching user's stores
  if (user.stores.length > 0) {
    return {
      filterCondition: 'and .store_id in array_unpack(<array<str>>$storeIds)',
      params: { storeIds: user.stores },
    };
  }
  // No stores assigned — show nothing to prevent data leaks
  return {
    filterCondition: 'and false',
    params: {},
  };
}

export const checklistRoutes = new Hono<Env>()
  // All routes require authentication
  .use('*', authMiddleware)

  /**
   * GET /api/checklist/items
   * Fetch checklist items (from DetailChecklistItem) with Sheet 1 approval records
   * Both Sheet 1 and Sheet 2 now share the same checklist items
   */
  .get('/items', zValidator('query', DateQuerySchema), async (c) => {
    const { date, staff_id } = c.req.valid('query');
    const db = c.get('db');
    const user = c.get('user');
    const log = c.get('log');

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    log?.debug({ userId: user.sub, role: user.role, date, staff_id }, 'Fetching checklist items');

    const { filterCondition, params } = buildStaffFilter(user, staff_id);

    // ---------------------------------------------------------------
    // Sheet 3 assignment filter for employees:
    // If any TaskAssignment exists in the employee's store(s), only
    // show items that are explicitly assigned to them.
    // If zero assignments exist (backwards compat), show everything.
    // ---------------------------------------------------------------
    let itemFilter = '.is_deleted = false';
    const queryParams: Record<string, unknown> = { ...params };

    // Determine the target employee ID for assignment filtering:
    // - Employee viewing own data            → user.sub
    // - CHT/ASM viewing a specific employee  → staff_id
    // - CHT/ASM viewing self or no target    → null (show all items)
    const assignmentTargetId =
      user.role === 'employee'
        ? user.sub
        : staff_id && staff_id !== user.sub
          ? staff_id
          : null;

    if (assignmentTargetId) {
      const countQuery = `
        select count(
          TaskAssignment
          filter .is_deleted = false
            and .store_id in array_unpack(<array<str>>$empStoreIds)
        )
      `;
      const assignmentCount = await db.queryRequiredSingle<number>(countQuery, {
        empStoreIds: user.stores,
      });

      if (assignmentCount > 0) {
        itemFilter = `.is_deleted = false
          and exists (
            select .task_assignments filter
              .is_deleted = false
              and .employee_id = <str>$assignedEmployeeId
          )`;
        queryParams.assignedEmployeeId = assignmentTargetId;
      }
    }

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
            baseline,
            category: { id, name, category_type, classification_criteria },
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
          filter ${itemFilter}
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
            baseline,
            category: { id, name, category_type, classification_criteria },
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
          filter ${itemFilter}
          order by .category.order then .order then .item_number
        `;

    const result = date
      ? await db.query(query, {
          ...queryParams,
          date: new LocalDate(
            Number.parseInt(date.split('-')[0], 10),
            Number.parseInt(date.split('-')[1], 10),
            Number.parseInt(date.split('-')[2], 10),
          ),
        })
      : await db.query(query, queryParams);

    return c.json(result);
  })

  /**
   * GET /api/checklist/assessment-dates
   * Fetch available assessment dates from Sheet 1 records, filtered by user role
   */
  .get('/assessment-dates', async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    const staffIdParam = c.req.query('staff_id');

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Build filter for staff_id / store_id
    const { filterCondition: rawFilter, params } = buildStaffFilter(user, staffIdParam);
    // Rewrite filter to use ChecklistRecord prefix instead of implicit `.`
    const filterCondition = rawFilter
      .replace('and .staff_id', 'and ChecklistRecord.staff_id')
      .replace('and .store_id', 'and ChecklistRecord.store_id')
      .replace('and false', 'and false');

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
  .get('/detail-items', zValidator('query', MonthYearQuerySchema), async (c) => {
    const { month, year, staff_id } = c.req.valid('query');
    const db = c.get('db');
    const user = c.get('user');
    const log = c.get('log');

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const currentDate = new Date();
    const targetMonth = month ?? currentDate.getMonth() + 1;
    const targetYear = year ?? currentDate.getFullYear();

    log?.debug(
      { userId: user.sub, role: user.role, month: targetMonth, year: targetYear, staff_id },
      'Fetching detail checklist items',
    );

    const { filterCondition, params: staffParams } = buildStaffFilter(user, staff_id);

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
        baseline,
        category: { id, name, category_type, classification_criteria },
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
  .get('/categories', async (c) => {
    const db = c.get('db');

    const query = `
      select DetailCategory {
        id,
        name,
        category_type,
        description,
        order,
        classification_criteria
      }
      order by .order
    `;

    const result = await db.query(query);
    return c.json(result);
  })

  /**
   * GET /api/checklist/summary
   * Returns notification summary based on role:
   * - Employee: count of unchecked items for today
   * - CHT/ASM: count of staff with incomplete checklists today
   */
  .get('/summary', async (c) => {
    const db = c.get('db');
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const today = new Date();
    const todayLocal = new LocalDate(today.getFullYear(), today.getMonth() + 1, today.getDate());

    if (user.role === 'employee') {
      // Employee: count total items and items with employee_checked = true for today
      const totalQuery = `select count(DetailChecklistItem filter .is_deleted = false)`;
      const checkedQuery = `
        select count(
          DetailChecklistItem filter .is_deleted = false
            and exists (
              select .checklist_records filter
                .is_deleted = false
                and .staff_id = <str>$staffId
                and .assessment_date = <cal::local_date>$today
                and .employee_checked = true
            )
        )
      `;

      const [totalResult, checkedResult] = await Promise.all([
        db.queryRequiredSingle<number>(totalQuery),
        db.queryRequiredSingle<number>(checkedQuery, {
          staffId: user.sub,
          today: todayLocal,
        }),
      ]);

      const totalItems = totalResult;
      const checkedItems = checkedResult;

      return c.json({
        role: 'employee',
        uncheckedItems: totalItems - checkedItems,
        totalItems,
      });
    }

    // CHT/ASM: count staff with incomplete checklists in their stores
    if (user.stores.length === 0) {
      return c.json({
        role: user.role,
        incompleteStaff: 0,
        totalStaff: 0,
      });
    }

    const totalItemsQuery = `select count(DetailChecklistItem filter .is_deleted = false)`;
    const totalItems = await db.queryRequiredSingle<number>(totalItemsQuery);

    // Get all employees from Casdoor for these stores
    const { fetchCasdoorUsersByStores } = await import('../lib/oidc.js');
    const allEmployees = await fetchCasdoorUsersByStores(user.stores, user.role);

    // Build a set of staff_ids (user.sub) from employees, excluding current user
    // Note: ChecklistRecord.staff_id stores user.sub (OIDC sub claim), not casdoor_id
    // We need to map from employee list to their corresponding user.sub values
    // For now, we'll filter in the database query instead
    const totalStaff = allEmployees.length - 1; // Exclude current user from count

    // Get staff IDs who have completed all items today (employee_checked = true for all items)
    // Exclude the current user from this query as well
    const completeStaffQuery = `
      select distinct ChecklistRecord.staff_id
      filter ChecklistRecord.is_deleted = false
        and ChecklistRecord.store_id in array_unpack(<array<str>>$storeIds)
        and ChecklistRecord.assessment_date = <cal::local_date>$today
        and ChecklistRecord.employee_checked = true
        and ChecklistRecord.staff_id != <str>$currentUserId
      group by ChecklistRecord.staff_id
      having count(ChecklistRecord) >= <int64>$totalItems
    `;

    try {
      const completeStaffIds = await db.query<string>(completeStaffQuery, {
        storeIds: user.stores,
        today: todayLocal,
        totalItems,
        currentUserId: user.sub,
      });

      const completeStaffCount = completeStaffIds.length;
      const incompleteStaffCount = totalStaff - completeStaffCount;

      return c.json({
        role: user.role,
        incompleteStaff: incompleteStaffCount,
        totalStaff: totalStaff,
      });
    } catch {
      // Fallback: if query fails, assume all staff are incomplete
      return c.json({
        role: user.role,
        incompleteStaff: totalStaff,
        totalStaff: totalStaff,
      });
    }
  })

  /**
   * POST /api/checklist/records/upsert
   * Create or update a ChecklistRecord (Sheet 1 approval workflow) for the current user
   * Uses INSERT ... UNLESS CONFLICT to handle upsert
   */
  .post('/records/upsert', zValidator('json', UpsertChecklistRecordSchema), async (c) => {
    const body = c.req.valid('json');
    const db = c.get('db');
    const user = c.get('user');
    const log = c.get('log');

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Role-based column access control
    // Employee: Column B only | CHT: Column C only | ASM: Column D only
    const requestedColumns: ChecklistColumn[] = [];
    if (body.employee_checked !== undefined) requestedColumns.push('employee_checked');
    if (body.cht_checked !== undefined) requestedColumns.push('cht_checked');
    if (body.asm_checked !== undefined) requestedColumns.push('asm_checked');

    const validation = validateColumnAccess(user.role, requestedColumns);
    if (!validation.allowed) {
      const columnNames = { employee_checked: 'NHÂN VIÊN', cht_checked: 'CHT', asm_checked: 'ASM' };
      const denied = validation.deniedColumns.map(c => columnNames[c]).join(', ');
      log?.warn({ role: user.role, requested: requestedColumns, denied: validation.deniedColumns }, 'Unauthorized column access');
      return c.json({ error: `You can only edit your own column. Cannot update: ${denied}` }, 403);
    }

    const allowedFields = getAllowedColumns(user.role);

    // Build the SET clause for fields that are provided and allowed
    const setClauses: string[] = [];
    const storeId = user.stores[0] ?? '';
    const assessmentDate = new LocalDate(
      Number.parseInt(body.assessment_date.split('-')[0], 10),
      Number.parseInt(body.assessment_date.split('-')[1], 10),
      Number.parseInt(body.assessment_date.split('-')[2], 10),
    );
    const params: Record<string, unknown> = {
      checklistItemId: body.checklist_item_id,
      staffId: user.sub,
      storeId,
      assessmentDate,
    };

    // Calculate deadline_date (assessment_date + 3 days)
    const assessmentDateObj = new Date(
      assessmentDate.year,
      assessmentDate.month - 1,
      assessmentDate.day
    );
    assessmentDateObj.setDate(assessmentDateObj.getDate() + 3);
    const deadlineDate = new LocalDate(
      assessmentDateObj.getFullYear(),
      assessmentDateObj.getMonth() + 1,
      assessmentDateObj.getDate()
    );
    params.deadlineDate = deadlineDate;

    // Check if current date is past deadline
    const today = new Date();
    const isPastDeadline = today > assessmentDateObj;

    if (body.employee_checked !== undefined && allowedFields.includes('employee_checked')) {
      setClauses.push('employee_checked := <bool>$employeeChecked');
      params.employeeChecked = body.employee_checked;
      // Set timestamp when checking (not unchecking)
      if (body.employee_checked) {
        setClauses.push('employee_checked_at := datetime_current()');
      }
    }
    if (body.cht_checked !== undefined && allowedFields.includes('cht_checked')) {
      setClauses.push('cht_checked := <bool>$chtChecked');
      params.chtChecked = body.cht_checked;
      // Set timestamp when checking (not unchecking)
      if (body.cht_checked) {
        setClauses.push('cht_checked_at := datetime_current()');
      }
    }
    if (body.asm_checked !== undefined && allowedFields.includes('asm_checked')) {
      setClauses.push('asm_checked := <bool>$asmChecked');
      params.asmChecked = body.asm_checked;
      // Set timestamp when checking (not unchecking)
      if (body.asm_checked) {
        setClauses.push('asm_checked_at := datetime_current()');
      }
    }

    // Set deadline_date if not already set
    setClauses.push('deadline_date := <cal::local_date>$deadlineDate ?? .deadline_date');

    // Always update the updated_at timestamp
    setClauses.push('updated_at := datetime_current()');

    // Build INSERT fields dynamically
    const insertFields: string[] = [];
    if (body.employee_checked !== undefined && allowedFields.includes('employee_checked')) {
      insertFields.push('employee_checked := <bool>$employeeChecked');
      if (body.employee_checked) {
        insertFields.push('employee_checked_at := datetime_current()');
      }
    }
    if (body.cht_checked !== undefined && allowedFields.includes('cht_checked')) {
      insertFields.push('cht_checked := <bool>$chtChecked');
      if (body.cht_checked) {
        insertFields.push('cht_checked_at := datetime_current()');
      }
    }
    if (body.asm_checked !== undefined && allowedFields.includes('asm_checked')) {
      insertFields.push('asm_checked := <bool>$asmChecked');
      if (body.asm_checked) {
        insertFields.push('asm_checked_at := datetime_current()');
      }
    }
    // Always set deadline_date on insert
    insertFields.push('deadline_date := <cal::local_date>$deadlineDate');

    // Use INSERT ... UNLESS CONFLICT for upsert
    // Now using DetailChecklistItem instead of ChecklistItem
    const query = `
      with
        item := (select DetailChecklistItem filter .id = <uuid>$checklistItemId),
      insert ChecklistRecord {
        checklist_item := item,
        staff_id := <str>$staffId,
        store_id := <str>$storeId,
        assessment_date := <cal::local_date>$assessmentDate${insertFields.length > 0 ? ',\n        ' + insertFields.join(',\n        ') : ''},
        created_at := datetime_current(),
        updated_at := datetime_current()
      }
      unless conflict on ((.checklist_item, .staff_id, .assessment_date))
      else (
        update ChecklistRecord
        set {
          ${setClauses.join(',\n          ')}
        }
      )
    `;

    try {
      const result = await db.query(query, params);
      return c.json({ success: true, data: result });
    } catch (error) {
      log?.error({ error, params }, 'Failed to upsert checklist record');
      return c.json({ error: 'Failed to save record' }, 500);
    }
  })

  /**
   * POST /api/checklist/detail-records/upsert
   * Create or update a DetailMonthlyRecord (Sheet 2 monthly tracking) for the current user
   * Uses INSERT ... UNLESS CONFLICT to handle upsert
   */
  .post('/detail-records/upsert', zValidator('json', UpsertDetailMonthlyRecordSchema), async (c) => {
    const body = c.req.valid('json');
    const db = c.get('db');
    const user = c.get('user');
    const log = c.get('log');

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    log?.debug({ userId: user.sub, body }, 'Upserting detail monthly record');

    const storeId = user.stores[0] ?? '';
    const params: Record<string, unknown> = {
      detailItemId: body.detail_item_id,
      staffId: user.sub,
      storeId,
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
        store_id := <str>$storeId,
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
      log?.error({ error, params }, 'Failed to upsert detail monthly record');
      return c.json({ error: 'Failed to save record' }, 500);
    }
  })

  /**
   * POST /api/checklist/records/validate-deadlines
   * Validate and invalidate records that are past the 3-day deadline without CHT approval
   * This should be called periodically (e.g., on page load or daily cron job)
   */
  .post('/records/validate-deadlines', async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    const log = c.get('log');

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
      // Find all records where:
      // 1. deadline_date < today
      // 2. employee_checked = true
      // 3. cht_checked = false (CHT didn't validate within deadline)
      // 4. is_locked = false (not already locked)

      const query = `
        with
          today := cal::to_local_date(datetime_current(), 'UTC'),
          expired_records := (
            select ChecklistRecord
            filter
              .deadline_date < today
              and .employee_checked = true
              and .cht_checked = false
              and .is_locked = false
          )
        update expired_records
        set {
          # Uncheck employee checkbox
          employee_checked := false,
          # Lock the record
          is_locked := true,
          locked_at := datetime_current(),
          updated_at := datetime_current()
        }
      `;

      const result = await db.query(query);

      // Get the invalidated records to sync with Sheet 2
      const getInvalidatedQuery = `
        with
          today := cal::to_local_date(datetime_current(), 'UTC')
        select ChecklistRecord {
          id,
          checklist_item: { id },
          staff_id,
          assessment_date
        }
        filter
          .is_locked = true
          and .locked_at >= datetime_current() - <duration>'1 hour'
      `;

      const invalidatedRecords = await db.query(getInvalidatedQuery);

      // For each invalidated record, uncheck the corresponding day in Sheet 2
      for (const record of invalidatedRecords as any[]) {
        const assessmentDate = record.assessment_date;
        const month = assessmentDate.month;
        const year = assessmentDate.year;
        const day = assessmentDate.day;

        // Update the corresponding DetailMonthlyRecord
        const updateSheet2Query = `
          with
            item := (select DetailChecklistItem filter .id = <uuid>$itemId),
            existing := (
              select DetailMonthlyRecord
              filter
                .detail_item = item
                and .staff_id = <str>$staffId
                and .month = <int32>$month
                and .year = <int32>$year
              limit 1
            ),
            current_checks := existing.daily_checks ?? array_agg((
              for i in range_unpack(range(0, 31))
              union (select false)
            )),
            updated_checks := (
              select array_agg((
                for idx in range_unpack(range(0, 31))
                union (
                  select (
                    if idx = (<int32>$day - 1)
                    then false
                    else current_checks[idx] ?? false
                  )
                )
              ))
            )
          update existing
          set {
            daily_checks := updated_checks,
            updated_at := datetime_current()
          }
        `;

        await db.query(updateSheet2Query, {
          itemId: record.checklist_item.id,
          staffId: record.staff_id,
          month,
          year,
          day
        });
      }

      log?.info({ count: result.length, invalidatedCount: invalidatedRecords.length }, 'Validated deadlines and invalidated expired tasks');

      return c.json({
        success: true,
        invalidatedCount: result.length,
        sheet2UpdatedCount: invalidatedRecords.length
      });
    } catch (error) {
      log?.error({ error }, 'Failed to validate deadlines');
      return c.json({ error: 'Failed to validate deadlines' }, 500);
    }
  });
