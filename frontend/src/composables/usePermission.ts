import { computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import type { Permission, Role } from "@/types/auth";

export const usePermission = () => {
  const auth = useAuthStore();

  // Check single permission
  const can = (permission: Permission): boolean => {
    return auth.hasPermission(permission);
  };

  // Check if user has any of the permissions
  const canAny = (...permissions: Permission[]): boolean => {
    return auth.hasAnyPermission(...permissions);
  };

  // Check if user has all permissions
  const canAll = (...permissions: Permission[]): boolean => {
    return auth.hasAllPermissions(...permissions);
  };

  // Check if user has specific role
  const isRole = (role: Role): boolean => {
    return auth.role === role;
  };

  // Check if user has any of the roles
  const isAnyRole = (...roles: Role[]): boolean => {
    return roles.includes(auth.role as Role);
  };

  // Computed helpers for common checks
  const canCheckEmployee = computed(() => can("checklist:check_employee"));
  const canCheckCht = computed(() => can("checklist:check_cht"));
  const canCheckAsm = computed(() => can("checklist:check_asm"));
  const canViewSheet = computed(() => can("sheet:view"));

  // Role checks
  const isEmployee = computed(() => isRole("employee"));
  const isCht = computed(() => isRole("cht"));
  const isAsm = computed(() => isRole("asm"));

  return {
    // Permission checks
    can,
    canAny,
    canAll,

    // Role checks
    isRole,
    isAnyRole,

    // Computed permission helpers
    canCheckEmployee,
    canCheckCht,
    canCheckAsm,
    canViewSheet,

    // Computed role helpers
    isEmployee,
    isCht,
    isAsm,

    // Access to auth store data
    role: computed(() => auth.role),
    user: computed(() => auth.user),
    isAuthenticated: computed(() => auth.isAuthenticated),
  };
};
