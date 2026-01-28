// Role definitions
export const ROLES = {
  ASM: "asm",
  CHT: "cht",
  EMPLOYEE: "employee",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Permission definitions
export type Permission =
  | "sheet:view"
  | "checklist:check_employee"
  | "checklist:check_cht"
  | "checklist:check_asm";

// Role to permissions mapping
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  asm: [
    "sheet:view",
    "checklist:check_employee",
    "checklist:check_cht",
    "checklist:check_asm",
  ],
  cht: ["sheet:view", "checklist:check_employee", "checklist:check_cht"],
  employee: ["sheet:view", "checklist:check_employee"],
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
