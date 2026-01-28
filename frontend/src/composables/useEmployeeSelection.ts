import { ref, computed } from 'vue';
import type { StoreEmployee } from '@/lib/gel-client';

/**
 * Composable for managing employee selection state
 * @returns Employee selection utilities
 */
export const useEmployeeSelection = () => {
  const selectedId = ref<string | null>(null);

  /**
   * Select an employee
   * @param emp - The employee to select
   * @param onSelect - Callback to execute when employee is selected
   */
  const selectEmployee = (emp: StoreEmployee, onSelect: (emp: StoreEmployee) => void) => {
    if (selectedId.value === emp.id) {
      return; // Already selected - avoid unnecessary updates
    }
    selectedId.value = emp.id;
    onSelect(emp);
  };

  /**
   * Clear the current selection
   * @param onClear - Callback to execute when selection is cleared
   */
  const clearSelection = (onClear: () => void) => {
    selectedId.value = null;
    onClear();
  };

  /**
   * Check if an employee is currently selected
   * @param empId - The employee ID to check
   * @returns True if the employee is selected
   */
  const isSelected = (empId: string): boolean => {
    return selectedId.value === empId;
  };

  /**
   * Computed property for the selected ID
   */
  const selected = computed(() => selectedId.value);

  return {
    selectedId,
    selected,
    selectEmployee,
    clearSelection,
    isSelected,
  };
};
