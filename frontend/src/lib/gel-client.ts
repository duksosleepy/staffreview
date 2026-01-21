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
 */

const API_BASE = "/api/checklist";

// ===================================================
// Types
// ===================================================

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
  staff_id: string;
  checklist_item: {
    name: string;
    standard_score: number | null;
    checklist: { name: string };
  };
};

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
    staff_id: string;
  } | null;
};

export type DetailCategoryType = "daily" | "weekly" | "monthly";

export type DetailCategory = {
  id: string;
  name: string;
  category_type: DetailCategoryType;
  description: string | null;
  order: number;
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
  staff_id: string;
};

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
 * Fetch checklist items with records for a specific date
 * Server automatically filters by user's role and employee_id
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
 * Fetch available assessment dates
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
 * Fetch detail checklist items with monthly records
 * Server automatically filters by user's role and employee_id
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

// Legacy function - kept for backwards compatibility but now uses secure endpoint
export async function fetchChecklistRecords(): Promise<ChecklistRecord[]> {
  // This functionality is now handled by fetchAllChecklistItems
  // Returns empty array - use fetchAllChecklistItems instead
  console.warn(
    "fetchChecklistRecords is deprecated. Use fetchAllChecklistItems instead.",
  );
  return [];
}
