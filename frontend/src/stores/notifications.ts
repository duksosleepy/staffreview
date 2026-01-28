import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { type ChecklistSummary, fetchChecklistSummary } from '@/lib/gel-client';

export const useNotificationStore = defineStore('notifications', () => {
  const summary = ref<ChecklistSummary | null>(null);
  const hasLoaded = ref(false);

  const notificationCount = computed(() => {
    if (!summary.value) return 0;
    if (summary.value.role === 'employee') {
      return summary.value.uncheckedItems;
    }
    return summary.value.incompleteStaff;
  });

  const notificationMessage = computed(() => {
    if (!summary.value) return '';
    if (summary.value.role === 'employee') {
      const { uncheckedItems, totalItems } = summary.value;
      if (uncheckedItems === 0) return 'Tat ca muc da duoc kiem tra hom nay';
      return `Ban con ${uncheckedItems}/${totalItems} muc chua kiem tra hom nay`;
    }
    const { incompleteStaff, totalStaff } = summary.value;
    if (incompleteStaff === 0) return 'Tat ca nhan vien da hoan thanh checklist';
    return `${incompleteStaff}/${totalStaff} nhan vien chua hoan thanh checklist`;
  });

  const fetchSummary = async () => {
    try {
      summary.value = await fetchChecklistSummary();
    } catch {
      summary.value = null;
    } finally {
      hasLoaded.value = true;
    }
  };

  return {
    summary,
    hasLoaded,
    notificationCount,
    notificationMessage,
    fetchSummary,
  };
});
