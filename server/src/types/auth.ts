// Role definitions
export const ROLES = {
  ADMIN: 'admin',
  ASM: 'asm',
  CHT: 'cht',
  EMPLOYEE: 'employee',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Permission definitions
export type Permission =
  | 'sheet:view'
  | 'checklist:check_employee'
  | 'checklist:check_cht'
  | 'checklist:check_asm'
  | 'admin:view_all';

// Role to permissions mapping
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ['sheet:view', 'checklist:check_employee', 'checklist:check_cht', 'checklist:check_asm', 'admin:view_all'],
  asm: ['sheet:view', 'checklist:check_asm'], // ASM can only check ASM column
  cht: ['sheet:view', 'checklist:check_cht'], // CHT can only check CHT column
  employee: ['sheet:view', 'checklist:check_employee'], // Employee can only check employee column
};

// User type from JWT payload
export type AuthUser = {
  sub: string;
  name: string;
  displayName: string;
  email: string;
  role: Role;
  stores: string[];
  casdoor_id: string;
};

// OIDC token response (standard)
export type OIDCTokenResponse = {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
};

// OIDC user info from JWT (standard claims)
export type OIDCUserInfo = {
  sub: string;
  name: string;
  displayName?: string;
  email: string;
  preferred_username?: string;
  groups?: string[];
  roles?: string[];
  tag?: string;
};
