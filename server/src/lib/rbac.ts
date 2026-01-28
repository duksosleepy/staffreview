import type { Role } from '../types/auth.js';

/**
 * Sheet 1 Column-Level RBAC
 * - Employee can only edit Column B (employee_checked)
 * - CHT can only edit Column C (cht_checked)
 * - ASM can only edit Column D (asm_checked)
 */

export type ChecklistColumn = 'employee_checked' | 'cht_checked' | 'asm_checked';

const ROLE_COLUMN_MAP: Record<Role, ChecklistColumn[]> = {
  employee: ['employee_checked'],
  cht: ['cht_checked'],
  asm: ['asm_checked'],
};

/**
 * Validates column access and returns denied columns
 */
export function validateColumnAccess(userRole: Role, requestedColumns: ChecklistColumn[]): {
  allowed: boolean;
  deniedColumns: ChecklistColumn[];
} {
  const allowedColumns = ROLE_COLUMN_MAP[userRole] || [];
  const deniedColumns = requestedColumns.filter(col => !allowedColumns.includes(col));

  return {
    allowed: deniedColumns.length === 0,
    deniedColumns,
  };
}

/**
 * Gets allowed columns for a role
 */
export function getAllowedColumns(userRole: Role): ChecklistColumn[] {
  return ROLE_COLUMN_MAP[userRole] || [];
}
