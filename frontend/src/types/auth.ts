// Types matching /auth/me API response

export type Role = "asm" | "cht" | "employee";

export type Permission =
  | "sheet:view"
  | "checklist:check_employee"
  | "checklist:check_cht"
  | "checklist:check_asm";

export type AuthUser = {
  sub: string;
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
};

export type AuthMeResponse = {
  user: AuthUser;
};

export type AuthCheckResponse = {
  authenticated: boolean;
};
