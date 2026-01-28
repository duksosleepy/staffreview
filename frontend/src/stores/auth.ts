import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { AuthCheckResponse, AuthMeResponse, AuthUser, Permission } from '@/types/auth';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const isLoading = ref(true);
  const error = ref<string | null>(null);

  // Computed properties
  const isAuthenticated = computed(() => !!user.value);
  const role = computed(() => user.value?.role ?? null);
  const permissions = computed(() => user.value?.permissions ?? []);
  const userName = computed(() => user.value?.displayName ?? user.value?.name ?? '');
  const userDisplayName = computed(() => user.value?.displayName ?? user.value?.name ?? '');
  const userEmail = computed(() => user.value?.email ?? '');
  const stores = computed(() => user.value?.stores ?? []);
  const casdoorId = computed(() => user.value?.casdoor_id ?? '');

  // Check if user has a specific permission
  const hasPermission = (permission: Permission): boolean => {
    return permissions.value.includes(permission);
  };

  // Check if user has any of the given permissions
  const hasAnyPermission = (...perms: Permission[]): boolean => {
    return perms.some((p) => permissions.value.includes(p));
  };

  // Check if user has all of the given permissions
  const hasAllPermissions = (...perms: Permission[]): boolean => {
    return perms.every((p) => permissions.value.includes(p));
  };

  // Fetch current user from API
  const fetchUser = async (): Promise<boolean> => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch('/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data: AuthMeResponse = await response.json();
        user.value = data.user;
        return true;
      }

      user.value = null;
      return false;
    } catch (err) {
      error.value = 'Failed to fetch user';
      user.value = null;
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  // Check if authenticated (quick check without full user data)
  const checkAuth = async (): Promise<boolean> => {
    try {
      const response = await fetch('/auth/check', {
        credentials: 'include',
      });

      if (response.ok) {
        const data: AuthCheckResponse = await response.json();
        return data.authenticated;
      }

      return false;
    } catch {
      return false;
    }
  };

  // Redirect to login
  const login = (): void => {
    window.location.href = '/auth/login';
  };

  // Logout user
  const logout = async (): Promise<void> => {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      user.value = null;
      window.location.href = '/';
    }
  };

  // Clear user state
  const clearUser = (): void => {
    user.value = null;
    error.value = null;
  };

  return {
    // State
    user,
    isLoading,
    error,

    // Computed
    isAuthenticated,
    role,
    permissions,
    userName,
    userEmail,
    stores,
    casdoorId,

    // Methods
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    fetchUser,
    checkAuth,
    login,
    logout,
    clearUser,
  };
});
