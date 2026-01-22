/**
 * Secure API client for checklist data
 *
 * All data fetching goes through secure server endpoints that:
 * 1. Authenticate the user via httpOnly JWT cookie
 * 2. Apply role-based filtering server-side
 * 3. Never expose raw query capability
 *
 * Security: User cannot tamper with requests to access other users' data
 * because filtering is done server-side based on the JWT token.
 *
 * UNIFIED CHECKLIST SYSTEM:
 * Both Sheet 1 and Sheet 2 now share the same checklist items (DetailChecklistItem)
 * but use different record types:
 * - Sheet 1: ChecklistRecord (approval workflow with employee/CHT/ASM checkboxes)
 * - Sheet 2: DetailMonthlyRecord (monthly tracking with 31 daily checkboxes)
 */

const API_BASE = "/api/checklist";

// ===================================================
// Types
// ===================================================

export type DetailCategoryType = "daily" | "weekly" | "monthly";

export type DetailCategory = {
  id: string;
  name: string;
  category_type: DetailCategoryType;
  description: string | null;
  order: number;
};

// Sheet 1 Record Type - Approval Workflow
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
  staff_id: string;
};

// Sheet 2 Record Type - Monthly Tracking
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
  staff_id: string;
};

/**
 * Unified checklist item type (from DetailChecklistItem)
 * Used by both Sheet 1 and Sheet 2
 */
export type ChecklistItemWithRecord = {
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
  // Sheet 1 uses this record type (approval workflow)
  record: ChecklistRecord | null;
};

/**
 * Detail checklist item with monthly record (for Sheet 2)
 * Same item structure but with different record type
 */
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
  // Sheet 2 uses this record type (monthly tracking)
  record: DetailMonthlyRecord | null;
};

// ===================================================
// API Error Handling
// ===================================================

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      // Redirect to login on auth error
      window.location.href = "/login";
      throw new ApiError(401, "Unauthorized");
    }
    throw new ApiError(response.status, `API error: ${response.statusText}`);
  }
  return response.json();
}

// ===================================================
// Secure API Functions
// ===================================================

/**
 * Fetch checklist items with Sheet 1 records (approval workflow) for a specific date
 * Server automatically filters by user's role and employee_id
 * Items come from DetailChecklistItem (shared with Sheet 2)
 */
export async function fetchAllChecklistItems(
  date?: string,
): Promise<ChecklistItemWithRecord[]> {
  const url = new URL(`${API_BASE}/items`, window.location.origin);
  if (date) {
    url.searchParams.set("date", date);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    credentials: "include",
  });

  return handleResponse<ChecklistItemWithRecord[]>(response);
}

/**
 * Fetch available assessment dates for Sheet 1
 * Server automatically filters to show only dates the user has access to
 */
export async function fetchAvailableAssessmentDates(): Promise<string[]> {
  const response = await fetch(`${API_BASE}/assessment-dates`, {
    method: "GET",
    credentials: "include",
  });

  return handleResponse<string[]>(response);
}

/**
 * Fetch detail checklist items with Sheet 2 records (monthly tracking)
 * Server automatically filters by user's role and employee_id
 * Items come from DetailChecklistItem (shared with Sheet 1)
 */
export async function fetchAllDetailChecklistItems(
  month?: number,
  year?: number,
): Promise<DetailChecklistItemWithRecord[]> {
  const url = new URL(`${API_BASE}/detail-items`, window.location.origin);
  if (month !== undefined) {
    url.searchParams.set("month", month.toString());
  }
  if (year !== undefined) {
    url.searchParams.set("year", year.toString());
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    credentials: "include",
  });

  return handleResponse<DetailChecklistItemWithRecord[]>(response);
}

/**
 * Fetch detail categories (metadata only, no user filtering)
 */
export async function fetchDetailCategories(): Promise<DetailCategory[]> {
  const response = await fetch(`${API_BASE}/categories`, {
    method: "GET",
    credentials: "include",
  });

  return handleResponse<DetailCategory[]>(response);
}

// ===================================================
// Upsert Functions (Create or Update)
// ===================================================

// Sheet 1 - Approval Workflow Record
export type UpsertChecklistRecordPayload = {
  checklist_item_id: string;
  assessment_date: string; // YYYY-MM-DD
  employee_checked?: boolean;
  cht_checked?: boolean;
  asm_checked?: boolean;
};

export type UpsertChecklistRecordResponse = {
  success: boolean;
  data?: unknown;
  error?: string;
};

/**
 * Create or update a ChecklistRecord (Sheet 1 approval workflow) for the current user
 * - If a record exists for the (checklist_item, staff_id, assessment_date), update it
 * - Otherwise, create a new record
 * - Server enforces role-based permissions (employee can only set employee_checked, etc.)
 */
export async function upsertChecklistRecord(
  payload: UpsertChecklistRecordPayload,
): Promise<UpsertChecklistRecordResponse> {
  const response = await fetch(`${API_BASE}/records/upsert`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401) {
      window.location.href = "/login";
      throw new ApiError(401, "Unauthorized");
    }
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorData.error || `API error: ${response.statusText}`,
    );
  }

  return response.json();
}

// Sheet 2 - Monthly Tracking Record
export type UpsertDetailMonthlyRecordPayload = {
  detail_item_id: string;
  month: number;
  year: number;
  day: number; // 1-31
  checked: boolean;
};

export type UpsertDetailMonthlyRecordResponse = {
  success: boolean;
  data?: unknown;
  error?: string;
};

/**
 * Create or update a DetailMonthlyRecord (Sheet 2 monthly tracking) for the current user
 * - If a record exists for the (detail_item, staff_id, month, year), update the specific day
 * - Otherwise, create a new record with the day checked
 */
export async function upsertDetailMonthlyRecord(
  payload: UpsertDetailMonthlyRecordPayload,
): Promise<UpsertDetailMonthlyRecordResponse> {
  const response = await fetch(`${API_BASE}/detail-records/upsert`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401) {
      window.location.href = "/login";
      throw new ApiError(401, "Unauthorized");
    }
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorData.error || `API error: ${response.statusText}`,
    );
  }

  return response.json();
}
