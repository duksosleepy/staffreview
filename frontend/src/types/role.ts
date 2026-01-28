export enum RoleType {
  ASM = 'asm',
  CHT = 'cht',
  EMPLOYEE = 'employee',
}

export const ROLE_DISPLAY: Record<string, string> = {
  [RoleType.ASM]: 'ASM',
  [RoleType.CHT]: 'CHT',
  [RoleType.EMPLOYEE]: 'Employee',
  asm: 'ASM',
  cht: 'CHT',
  employee: 'Employee',
};

export const ROLE_BADGE_CLASSES: Record<string, string> = {
  [RoleType.ASM]: 'bg-gold-500 text-white border border-gold-600',
  [RoleType.CHT]: 'bg-vermillion-500 text-white border border-vermillion-600',
  [RoleType.EMPLOYEE]: 'bg-sky-500 text-white border border-sky-600',
  asm: 'bg-gold-500 text-white border border-gold-600',
  cht: 'bg-vermillion-500 text-white border border-vermillion-600',
  employee: 'bg-sky-500 text-white border border-sky-600',
};
