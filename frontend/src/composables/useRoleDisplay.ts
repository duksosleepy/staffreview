import { computed } from 'vue';
import { ROLE_BADGE_CLASSES, ROLE_DISPLAY } from '@/types/role';

/**
 * Composable for handling role display and styling
 * @returns Role display utilities
 */
export const useRoleDisplay = () => {
  /**
   * Get the CSS classes for a role badge
   * @param role - The role string to get classes for
   * @returns Tailwind CSS classes for the badge
   */
  const getRoleBadgeClass = (role: string): string => {
    const normalizedRole = role.toLowerCase();
    return ROLE_BADGE_CLASSES[normalizedRole] || 'bg-ink-lighter text-paper-muted border border-ink-faint';
  };

  /**
   * Get the display name for a role
   * @param role - The role string to get display name for
   * @returns Formatted display name
   */
  const getRoleDisplay = (role: string): string => {
    return ROLE_DISPLAY[role.toLowerCase()] || role;
  };

  /**
   * Get computed role badge classes (for use in templates)
   * @param role - Ref or computed containing the role
   * @returns Computed CSS classes
   */
  const getRoleBadgeClasses = (role: string, baseClasses = '') => {
    return computed(() => {
      const roleClasses = getRoleBadgeClass(role);
      return baseClasses ? `${baseClasses} ${roleClasses}` : roleClasses;
    });
  };

  return {
    getRoleBadgeClass,
    getRoleDisplay,
    getRoleBadgeClasses,
    roleDisplayMap: computed(() => ROLE_DISPLAY),
  };
};
