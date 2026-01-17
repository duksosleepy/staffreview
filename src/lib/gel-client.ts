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
export async function fetchAllChecklistItems(): Promise<ChecklistItemWithRecord[]> {
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
