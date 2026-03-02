// Use const object instead of enum (per project guidelines)
export const RoleType = {
  ADMIN: 'admin',
  ASM: 'asm',
  CHT: 'cht',
  EMPLOYEE: 'employee',
} as const;

export type Role = typeof RoleType[keyof typeof RoleType];

export const ROLE_DISPLAY: Record<string, string> = {
  admin: 'Admin',
  asm: 'ASM',
  cht: 'CHT',
  employee: 'Nhân viên',
};

export const ROLE_BADGE_CLASSES: Record<string, string> = {
  admin: 'bg-purple-600 text-white border border-purple-700',
  asm: 'bg-gold-500 text-white border border-gold-600',
  cht: 'bg-vermillion-500 text-white border border-vermillion-600',
  employee: 'bg-sky-500 text-white border border-sky-600',
};
