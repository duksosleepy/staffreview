import { zValidator } from '@hono/zod-validator';
import { LocalDate } from 'gel';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../lib/env.js';
import { authMiddleware } from '../middleware/auth.js';
import type { AuthUser } from '../types/auth.js';
import { validateColumnAccess, getAllowedColumns, type ChecklistColumn } from '../lib/rbac.js';
import type { Client } from 'gel';

/**
 * After any daily_checks change on a DetailMonthlyRecord, recompute:
 *   - achievement_percentage, successful_completions, score_achieved, classification
 *     on the affected DetailMonthlyRecord row
 *   - total_score, final_classification on EmployeeMonthlyScore (upsert)
 *
 * Called from both /detail-records/upsert and /records/validate-deadlines.
 */
async function recomputeMonthlyScore(
  db: Client,
  detailItemId: string,
  staffId: string,
  storeId: string,
  month: number,
  year: number,
): Promise<void> {
  // Fetch item metadata + current daily_checks
  const [meta] = await db.query<{
    score: number;
    baseline: number;
    category_type: string;
    classification_criteria: { thresholds: { A: number; B: number; C: number }; baseline?: number } | null;
    daily_checks: boolean[];
  }>(`
    with
      item := (select DetailChecklistItem filter .id = <uuid>$detailItemId),
      rec := assert_single((
        select DetailMonthlyRecord
        filter .detail_item = item
          and .staff_id = <str>$staffId
          and .month = <int32>$month
          and .year = <int32>$year
      ))
    select {
      score := item.score,
      baseline := item.baseline,
      category_type := item.category.category_type,
      classification_criteria := item.category.classification_criteria,
      daily_checks := rec.daily_checks
    }
  `, { detailItemId, staffId, month, year });

  if (!meta) return;

  const daysInMonth = new Date(year, month, 0).getDate();
  const effectiveBaseline =
    meta.category_type === 'daily'
      ? (meta.classification_criteria?.baseline ?? 26)
      : meta.baseline;

  const successfulCompletions = (meta.daily_checks ?? []).slice(0, daysInMonth).filter(Boolean).length;
  const achievementPct = effectiveBaseline > 0 ? (successfulCompletions / effectiveBaseline) * 100 : 0;
  const scoreAchieved = effectiveBaseline > 0 ? (successfulCompletions / effectiveBaseline) * meta.score : 0;

  const thresholds = meta.classification_criteria?.thresholds ?? { A: 8, B: 5, C: 3 };
  let itemClassification = 'KHONG_DAT';
  if (scoreAchieved >= thresholds.A) itemClassification = 'A';
  else if (scoreAchieved >= thresholds.B) itemClassification = 'B';
  else if (scoreAchieved >= thresholds.C) itemClassification = 'C';

  // Write computed values back to DetailMonthlyRecord
  await db.query(`
    update DetailMonthlyRecord
    filter .detail_item.id = <uuid>$detailItemId
      and .staff_id = <str>$staffId
      and .month = <int32>$month
      and .year = <int32>$year
    set {
      achievement_percentage := <float32>$achievementPct,
      successful_completions := <int32>$successfulCompletions,
      score_achieved := <float32>$scoreAchieved,
      classification := <str>$itemClassification,
      updated_at := datetime_current()
    }
  `, {
    detailItemId,
    staffId,
    month,
    year,
    achievementPct: Math.round(achievementPct * 100) / 100,
    successfulCompletions,
    scoreAchieved: Math.round(scoreAchieved * 100) / 100,
    itemClassification,
  });

  // Re-aggregate total_score for this staff/month/year
  const [agg] = await db.query<{ total: number }>(`
    select { total := sum((
      select DetailMonthlyRecord.score_achieved
      filter DetailMonthlyRecord.staff_id = <str>$staffId
        and DetailMonthlyRecord.month = <int32>$month
        and DetailMonthlyRecord.year = <int32>$year
        and not DetailMonthlyRecord.is_deleted
    )) }
  `, { staffId, month, year });

  const totalScore = agg?.total ?? 0;
  let finalClassification = 'D';
  if (totalScore >= 90) finalClassification = 'A';
  else if (totalScore >= 70) finalClassification = 'B';
  else if (totalScore > 50) finalClassification = 'C';

  // Upsert EmployeeMonthlyScore summary
  await db.query(`
    insert EmployeeMonthlyScore {
      staff_id := <str>$staffId,
      store_id := <str>$storeId,
      month := <int32>$month,
      year := <int32>$year,
      total_score := <float32>$totalScore,
      final_classification := <str>$finalClassification,
      created_at := datetime_current(),
      updated_at := datetime_current()
    }
    unless conflict on ((.staff_id, .month, .year))
    else (
      update EmployeeMonthlyScore
      set {
        total_score := <float32>$totalScore,
        final_classification := <str>$finalClassification,
        updated_at := datetime_current()
      }
    )
  `, { staffId, storeId, month, year, totalScore: Math.round(totalScore * 100) / 100, finalClassification });
}

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

    log?.info({ userId: user.sub, role: user.role, date, staff_id, casdoor_id: user.casdoor_id }, 'Fetching checklist items');

    const { filterCondition, params } = buildStaffFilter(user, staff_id);

    // ---------------------------------------------------------------
    // Task filtering for DetailChecklistItems
    // Tasks are now automatically assigned based on shift matching
    // (DetailChecklistItem.task_type matched with EmployeeSchedule.daily_schedule)
    // No explicit TaskAssignment type needed
    // ---------------------------------------------------------------
    let itemFilter = '.is_deleted = false';
    const queryParams: Record<string, unknown> = { ...params };

    // Owner filter: each role only sees tasks assigned to them.
    // When CHT views a specific employee (staff_id provided), show employee-owned tasks.
    if (user.role === 'employee') {
      itemFilter += " and .owner = 'employee'";
    } else if (user.role === 'cht') {
      if (staff_id) {
        // CHT viewing an employee's sheet — show tasks owned by employee
        itemFilter += " and .owner = 'employee'";
      } else {
        // CHT viewing their own task list
        itemFilter += " and .owner = 'cht'";
      }
    }
    // ASM: no owner filter — sees all tasks

    // Shift filter: auto-assign tasks based on the user's/employee's shift for the date.
    // Applies when:
    // 1. Employee views their own tasks
    // 2. CHT/ASM views a specific employee's tasks (staff_id provided)
    // 3. CHT views their own tasks (no staff_id) — filter by CHT's own shift
    const shouldFilterByShift = (user.role === 'employee' || user.role === 'cht' || staff_id) && date;

    log?.info({ shouldFilterByShift, staff_id, date, role: user.role }, 'Shift filter decision');

    if (shouldFilterByShift) {
      // Determine which employee's schedule to check
      // If staff_id is provided (CHT viewing employee), use that
      // Otherwise use current user's casdoor_id (employee viewing own)
      let targetHrId: string | null = null;

      if (staff_id) {
        // CHT/ASM viewing an employee - need to get employee's hr_id (casdoor_id)
        // staff_id is the Casdoor user UUID
        // We need to fetch the user from Casdoor to get their properties.ID (hr_id)
        try {
          const { fetchCasdoorUserById } = await import('../lib/oidc.js');
          const userInfo = await fetchCasdoorUserById(staff_id);
          targetHrId = userInfo?.casdoor_id || null;
          log?.info({ staff_id, targetHrId }, 'Resolved staff_id to hr_id');
        } catch (error) {
          log?.warn({ error, staff_id }, 'Failed to resolve staff_id to hr_id');
        }
      } else {
        targetHrId = user.casdoor_id;
      }

      // If we couldn't determine hr_id but have staff_id, try finding by store match
      // This is a fallback - we'll need better mapping later
      if (!targetHrId && staff_id) {
        // For now, skip filtering if we can't determine hr_id for CHT viewing employee
        // This will be improved when we add better user mapping
        log?.debug({ staff_id }, 'Skipping shift filter - cannot map staff_id to hr_id yet');
      }

      if (targetHrId && date) {
        // Parse the selected date to get the day of month
        const dateParts = date.split('-');
        const dayOfMonth = Number.parseInt(dateParts[2], 10); // Get day (1-31)

        // Query to get employee's shift for this date
        const employeeShiftQuery = `
          select EmployeeSchedule {
            daily_schedule
          }
          filter .hr_id = <str>$hrId
            and .store_id in array_unpack(<array<str>>$storeIds)
            and .is_deleted = false
          limit 1
        `;

        try {
          const employeeSchedule = await db.querySingle<{ daily_schedule: string[] }>(
            employeeShiftQuery,
            {
              hrId: targetHrId,
              storeIds: user.stores,
            }
          );

          if (employeeSchedule?.daily_schedule) {
            const dayIndex = dayOfMonth - 1; // Array is 0-indexed
            const shift = employeeSchedule.daily_schedule[dayIndex]?.trim().toUpperCase();

            if (shift) {
              // Extract first character (S, C, F) from shift codes like S1, C2, F7
              const shiftType = shift.charAt(0);

              // Filter items: show tasks matching this shift type (keep existing owner filter)
              if (shiftType === 'S' || shiftType === 'C' || shiftType === 'F') {
                itemFilter += ` and (.task_type = <optional default::ShiftType>$taskType or not exists .task_type)`;
                queryParams.taskType = shiftType;
                log?.info({ shiftType, date, hrId: targetHrId, isStaffView: !!staff_id, itemFilter, queryParams }, 'Filtering tasks by shift type');
              }
            }
          } else {
            log?.debug({ hrId: targetHrId }, 'No schedule found for employee');
          }
        } catch (error) {
          log?.warn({ error, hrId: targetHrId }, 'Failed to get employee schedule, showing all tasks');
        }
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
            owner,
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
            owner,
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

    // Owner filter for items: same logic as Sheet 1
    let itemOwnerFilter = '.is_deleted = false';
    if (user.role === 'employee') {
      itemOwnerFilter += " and .owner = 'employee'";
    } else if (user.role === 'cht') {
      if (staff_id) {
        itemOwnerFilter += " and .owner = 'employee'";
      } else {
        itemOwnerFilter += " and .owner = 'cht'";
      }
    }
    // ASM: no owner filter

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
        owner,
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
      filter ${itemOwnerFilter}
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
      // Employee: count only employee-owned items and those checked today
      const totalQuery = `select count(DetailChecklistItem filter .is_deleted = false and .owner = 'employee')`;
      const checkedQuery = `
        select count(
          DetailChecklistItem filter .is_deleted = false
            and .owner = 'employee'
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

    // CHT sees cht-owned tasks; ASM oversees employee tasks
    const ownerForRole = user.role === 'cht' ? 'cht' : 'employee';
    const totalItemsQuery = `select count(DetailChecklistItem filter .is_deleted = false and .owner = <str>$owner)`;
    const totalItems = await db.queryRequiredSingle<number>(totalItemsQuery, { owner: ownerForRole });

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
      await db.query(query, params);

      // Recompute score fields on the record and update EmployeeMonthlyScore summary
      await recomputeMonthlyScore(db, body.detail_item_id, user.sub, storeId, body.month, body.year);

      return c.json({ success: true });
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
          store_id,
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

        // Recompute score fields and update EmployeeMonthlyScore summary
        await recomputeMonthlyScore(db, record.checklist_item.id, record.staff_id, record.store_id ?? '', month, year);
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
  })

  /**
   * GET /api/checklist/report?month=&year=
   * Returns per-employee achievement summary for ASM export report.
   * Only ASM role is allowed.
   */
  .get('/report', async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    const log = c.get('log');

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (user.role !== 'asm') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const now = new Date();
    const targetMonth = c.req.query('month') ? Number.parseInt(c.req.query('month')!, 10) : now.getMonth() + 1;
    const targetYear = c.req.query('year') ? Number.parseInt(c.req.query('year')!, 10) : now.getFullYear();

    try {
      const { fetchCasdoorUsersByStores } = await import('../lib/oidc.js');
      const casdoorEmployees = await fetchCasdoorUsersByStores(user.stores, user.role);

      if (casdoorEmployees.length === 0) {
        return c.json([]);
      }

      // staffId (Casdoor user.id / OIDC sub) → casdoor_id (= hr_id in EmployeeSchedule)
      const staffIdToHrId = new Map<string, string>();
      for (const emp of casdoorEmployees) {
        if (emp.casdoor_id) {
          staffIdToHrId.set(emp.id, emp.casdoor_id);
        }
      }

      const hrIds = [...staffIdToHrId.values()];
      const staffIds = [...staffIdToHrId.keys()];

      // Query EmployeeSchedule for employee info keyed by hr_id
      const schedules = hrIds.length > 0
        ? await db.query<{ hr_id: string; employee_name: string; store_id: string; position: string | null }>(
            `select EmployeeSchedule { hr_id, employee_name, store_id, position }
             filter .hr_id in array_unpack(<array<str>>$hrIds) and .is_deleted = false`,
            { hrIds }
          )
        : [];

      const scheduleByHrId = new Map(schedules.map(s => [s.hr_id, s]));

      // Collect all store_ids to look up regions from Area table
      const storeIds = [...new Set(schedules.map(s => s.store_id).filter(Boolean))];
      const areas = storeIds.length > 0
        ? await db.query<{ store_id: string; region: string }>(
            `select Area { store_id, region } filter .store_id in array_unpack(<array<str>>$storeIds)`,
            { storeIds }
          )
        : [];

      const regionByStoreId = new Map(areas.map(a => [a.store_id, a.region]));

      // Query pre-aggregated EmployeeMonthlyScore for the target month/year
      const monthlyScores = staffIds.length > 0
        ? await db.query<{ staff_id: string; total_score: number; final_classification: string }>(
            `select EmployeeMonthlyScore { staff_id, total_score, final_classification }
             filter .staff_id in array_unpack(<array<str>>$staffIds)
               and .month = <int32>$month
               and .year = <int32>$year`,
            { staffIds, month: targetMonth, year: targetYear }
          )
        : [];

      const scoreByStaffId = new Map(monthlyScores.map(s => [s.staff_id, s]));

      // Build report rows (only employees, skip CHT/ASM)
      const rows = [];
      let stt = 1;
      for (const emp of casdoorEmployees) {
        if (emp.role !== 'employee') continue;
        if (!emp.casdoor_id) continue;

        const hrId = emp.casdoor_id;
        const schedule = scheduleByHrId.get(hrId);
        const storeId = schedule?.store_id ?? emp.stores[0] ?? '';
        const score = scoreByStaffId.get(emp.id);

        rows.push({
          stt: stt++,
          region: regionByStoreId.get(storeId) ?? '',
          store_id: storeId,
          asm_name: user.displayName,
          hr_id: hrId,
          employee_name: schedule?.employee_name ?? emp.displayName,
          position: schedule?.position ?? '',
          total_score: score?.total_score ?? null,
          final_classification: score?.final_classification ?? null,
        });
      }

      log?.info({ month: targetMonth, year: targetYear, rowCount: rows.length }, 'Report generated');
      return c.json(rows);
    } catch (error) {
      log?.error({ error }, 'Failed to generate report');
      return c.json({ error: 'Failed to generate report' }, 500);
    }
  });
