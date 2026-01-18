const API_URL = '/api/query';

export type Checklist = {
  id: string;
  name: string;
  description: string | null;
};

export type ChecklistItem = {
  id: string;
  name: string;
  standard_score: number | null;
  order: number;
  checklist: Checklist;
};

export type ChecklistRecord = {
  id: string;
  assessment_date: string;
  employee_checked: boolean;
  cht_checked: boolean;
  asm_checked: boolean;
  achievement_percentage: number | null;
  successful_completions: number | null;
  implementation_issues: string | null;
  score_achieved: number | null;
  final_classification: string | null;
  employee: { employee_id: string };
  checklist_item: {
    name: string;
    standard_score: number | null;
    checklist: { name: string };
  };
};

// Type for ChecklistItem with optional record data
export type ChecklistItemWithRecord = {
  id: string;
  name: string;
  standard_score: number | null;
  order: number;
  checklist: { name: string };
  record: {
    id: string;
    assessment_date: string;
    employee_checked: boolean;
    cht_checked: boolean;
    asm_checked: boolean;
    achievement_percentage: number | null;
    successful_completions: number | null;
    implementation_issues: string | null;
    score_achieved: number | null;
    final_classification: string | null;
    employee: { employee_id: string };
  } | null;
};

export async function fetchChecklistRecords(): Promise<ChecklistRecord[]> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        select ChecklistRecord {
          id, assessment_date, employee_checked, cht_checked, asm_checked,
          achievement_percentage, successful_completions, implementation_issues,
          score_achieved, final_classification,
          employee: { employee_id },
          checklist_item: { name, standard_score, checklist: { name } }
        }
        filter .is_deleted = false
        order by .checklist_item.checklist.name then .checklist_item.order then .assessment_date
      `,
    }),
  });

  if (!response.ok) throw new Error('Failed to fetch data');
  return response.json();
}

// Fetch all checklist items with their latest record (or null if none)
export async function fetchAllChecklistItems(): Promise<
  ChecklistItemWithRecord[]
> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
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
              employee: { employee_id }
            }
            filter .is_deleted = false
            order by .assessment_date desc
            limit 1
          ))
        }
        filter .is_deleted = false
        order by .checklist.name then .order
      `,
    }),
  });

  if (!response.ok) throw new Error('Failed to fetch data');
  return response.json();
}

// ===================================================
// SHEET 2: Detail Checklist Types and Functions
// ===================================================

export type DetailCategoryType = 'daily' | 'weekly' | 'monthly';

export type DetailCategory = {
  id: string;
  name: string;
  category_type: DetailCategoryType;
  description: string | null;
  order: number;
};

export type DetailChecklistItem = {
  id: string;
  item_number: number;
  name: string;
  evaluator: string | null;
  scope: string | null;
  time_frame: string | null;
  penalty_level_1: string | null;
  penalty_level_2: string | null;
  penalty_level_3: string | null;
  score: number;
  order: number;
  notes: string | null;
  category: { id: string; name: string; category_type: DetailCategoryType };
};

export type DetailMonthlyRecord = {
  id: string;
  month: number;
  year: number;
  daily_checks: boolean[] | null;
  achievement_percentage: number | null;
  successful_completions: number | null;
  implementation_issues_count: number | null;
  score_achieved: number | null;
  classification: string | null;
  notes: string | null;
  employee: { employee_id: string };
};

// Type for DetailChecklistItem with optional monthly record
export type DetailChecklistItemWithRecord = {
  id: string;
  item_number: number;
  name: string;
  evaluator: string | null;
  scope: string | null;
  time_frame: string | null;
  penalty_level_1: string | null;
  penalty_level_2: string | null;
  penalty_level_3: string | null;
  score: number;
  order: number;
  notes: string | null;
  category: { id: string; name: string; category_type: DetailCategoryType };
  record: DetailMonthlyRecord | null;
};

// Fetch all detail categories
export async function fetchDetailCategories(): Promise<DetailCategory[]> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        select DetailCategory {
          id,
          name,
          category_type,
          description,
          order
        }
        order by .order
      `,
    }),
  });

  if (!response.ok) throw new Error('Failed to fetch detail categories');
  return response.json();
}

// Fetch all detail checklist items with their latest record for a specific month/year
export async function fetchAllDetailChecklistItems(
  month?: number,
  year?: number,
): Promise<DetailChecklistItemWithRecord[]> {
  const currentDate = new Date();
  const targetMonth = month ?? currentDate.getMonth() + 1;
  const targetYear = year ?? currentDate.getFullYear();

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
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
              employee: { employee_id }
            }
            filter .is_deleted = false and .month = <int32>$month and .year = <int32>$year
            limit 1
          ))
        }
        filter .is_deleted = false
        order by .category.order then .order then .item_number
      `,
      variables: {
        month: targetMonth,
        year: targetYear,
      },
    }),
  });

  if (!response.ok) throw new Error('Failed to fetch detail checklist items');
  return response.json();
}
