<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue';
import { useLocalStorage, useAsyncState } from '@vueuse/core';
import { fetchStoreEmployees, type StoreEmployee } from '@/lib/gel-client';
import { useAuthStore } from '@/stores/auth';
import { useRoleDisplay } from '@/composables/useRoleDisplay';
import ChevronIcon from '@/components/icons/ChevronIcon.vue';
import { FOCUS_RING_CLASSES } from '@/constants/ui';

defineOptions({
  name: 'EmployeeSidebar',
});

interface Props {
  initialSelectedId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  initialSelectedId: undefined,
});

const auth = useAuthStore();
const { getRoleBadgeClass, getRoleDisplay } = useRoleDisplay();

const emit = defineEmits<{
  select: [employee: StoreEmployee | null];
}>();

// Use shallowRef for better performance with large arrays
const {
  state: employees,
  isLoading,
  error: asyncError,
  execute: loadEmployees,
} = useAsyncState(
  () => fetchStoreEmployees(),
  [],
  {
    immediate: false,
    onError: (e) => {
      console.error('Failed to load employees:', e);
    },
  }
);

const error = computed(() => asyncError.value ? 'Không thể tải danh sách nhân viên' : null);

// Persist sidebar collapse state
const isCollapsed = useLocalStorage('sidebar-collapsed', false);
const selectedId = shallowRef<string | null>(props.initialSelectedId || null);

/**
 * Groups employees by their assigned stores
 * @returns Map where keys are store names and values are employee arrays
 */
const employeesByStore = computed(() => {
  const grouped = new Map<string, StoreEmployee[]>();
  for (const emp of employees.value) {
    for (const store of emp.stores) {
      if (auth.stores.includes(store)) {
        if (!grouped.has(store)) {
          grouped.set(store, []);
        }
        grouped.get(store)!.push(emp);
      }
    }
  }
  return grouped;
});

/**
 * Get the effective role for an employee
 * Corrects for cases where the current user's role is incorrectly reported
 */
const getEffectiveRole = (employee: StoreEmployee): string => {
  // If this employee is the current user, use the current user's actual role
  if (employee.casdoor_id === auth.casdoorId) {
    return auth.role || employee.role;
  }
  return employee.role;
};

/**
 * Select an employee from the list
 */
const selectEmployee = (emp: StoreEmployee) => {
  if (selectedId.value === emp.id) {
    // Already selected - do nothing to avoid unnecessary reloads
    return;
  }

  selectedId.value = emp.id;
  emit('select', emp);
};

/**
 * Clear the current employee selection
 */
const clearSelection = () => {
  selectedId.value = null;
  emit('select', null);
};

onMounted(loadEmployees);
</script>

<template>
  <aside
    class="h-full flex flex-col bg-ink-deep transition-[width] duration-300 relative after:content-[''] after:absolute after:top-0 after:right-0 after:bottom-0 after:w-px after:bg-gradient-to-b after:from-transparent after:via-border-strong/50 after:to-transparent"
    :class="isCollapsed ? 'w-16' : 'w-72 md:w-64 lg:w-72'"
  >
    <!-- Sidebar Header -->
    <div v-if="!isCollapsed" class="flex items-center px-4 py-3 relative justify-between after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-border-subtle/70 after:to-transparent">
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <div class="min-w-0 flex-1">
          <h2 class="text-xs font-semibold text-paper-light uppercase tracking-wider truncate font-body">Nhân viên</h2>
        </div>
        <span class="text-xs text-paper-muted font-body tabular-nums">{{ employees.length }}</span>
      </div>
      <button
        :class="`p-2 rounded-md hover:bg-ink-lighter text-paper-muted hover:text-paper-white transition-colors duration-200 ${FOCUS_RING_CLASSES}`"
        @click="isCollapsed = !isCollapsed"
        title="Thu gọn"
        aria-label="Thu gọn danh sách nhân viên"
        :aria-expanded="true"
      >
        <ChevronIcon direction="left" double class="w-5 h-5" />
      </button>
    </div>

    <!-- Collapsed state: show centered collapse button -->
    <div v-if="isCollapsed" key="collapsed" class="flex-1 flex items-center justify-center">
      <button
        :class="`p-2 rounded-md hover:bg-ink-lighter text-paper-muted hover:text-paper-white transition-colors duration-200 ${FOCUS_RING_CLASSES}`"
        @click="isCollapsed = !isCollapsed"
        title="Mở rộng"
        aria-label="Mở rộng danh sách nhân viên"
        :aria-expanded="false"
      >
        <ChevronIcon direction="right" double class="w-5 h-5" />
      </button>
    </div>

    <!-- Expanded state: employee list -->
    <div v-else key="expanded" class="flex-1 overflow-y-auto">
      <!-- Loading -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-16">
        <div class="w-8 h-8 border-3 border-vermillion-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p class="text-sm text-paper-muted font-body">Đang tải...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="px-4 py-8 text-center">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-vermillion-500/10 mb-3">
          <svg class="w-5 h-5 text-vermillion-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p class="text-sm text-vermillion-400 mb-3 font-body">{{ error }}</p>
        <button
          :class="`w-full px-4 py-2 text-sm font-body text-vermillion-400 hover:bg-vermillion-500/10 rounded-lg transition-colors duration-200 border border-vermillion-500/20 ${FOCUS_RING_CLASSES}`"
          @click="loadEmployees"
        >
          Thử lại
        </button>
      </div>

      <!-- Employee List grouped by store -->
      <div v-else class="py-2">
        <div v-for="[storeName, storeEmployees] in employeesByStore" :key="storeName" class="mb-6">
          <!-- Store header -->
          <div class="px-4 py-2 mb-2">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-vermillion-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span class="text-xs font-semibold text-paper-white uppercase tracking-wider font-body">{{ storeName }}</span>
              <span class="text-xs text-paper-muted font-body">({{ storeEmployees.length }})</span>
            </div>
          </div>

          <!-- Employees in this store -->
          <div class="space-y-1 px-2">
            <button
              v-for="emp in storeEmployees"
              :key="emp.id"
              v-memo="[selectedId === emp.id, emp.displayName, emp.role, emp.casdoor_id]"
              type="button"
              :class="`w-full text-left px-3 py-2.5 rounded-lg transition-[background-color,border-color,color] duration-200 group border ${FOCUS_RING_CLASSES} ${
                selectedId === emp.id
                  ? 'bg-vermillion-500/10 border-vermillion-500/40'
                  : 'hover:bg-ink-lighter border-transparent'
              }`"
              :aria-pressed="selectedId === emp.id"
              :aria-label="`Xem dữ liệu của ${emp.displayName}, vai trò ${getRoleDisplay(getEffectiveRole(emp))}`"
              @click="selectEmployee(emp)"
            >
              <div class="flex items-center gap-3">
                <!-- Avatar -->
                <div
                  class="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-semibold shrink-0 transition-[background-color] duration-200"
                  :class="selectedId === emp.id
                    ? 'bg-vermillion-500'
                    : 'bg-ink-lighter'"
                >
                  {{ emp.displayName.charAt(0).toUpperCase() }}
                </div>
                <!-- Info -->
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2 mb-0.5">
                    <span
                      class="text-sm font-medium truncate"
                      :class="selectedId === emp.id ? 'text-vermillion-300' : 'text-paper-white'"
                      :title="emp.displayName"
                    >
                      {{ emp.displayName }}
                    </span>
                    <span
                      class="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase shrink-0"
                      :class="getRoleBadgeClass(getEffectiveRole(emp))"
                      :title="`Vai trò: ${getRoleDisplay(getEffectiveRole(emp))}`"
                    >
                      {{ getRoleDisplay(getEffectiveRole(emp)) }}
                    </span>
                  </div>
                  <p
                    v-if="emp.casdoor_id"
                    class="text-[10px] text-paper-muted truncate font-body"
                    :title="`ID: ${emp.casdoor_id}`"
                  >
                    ID: {{ emp.casdoor_id }}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="employeesByStore.size === 0 && !isLoading" class="px-4 py-16 text-center">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-ink-lighter mb-3">
            <svg class="w-7 h-7 text-paper-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p class="text-sm text-paper-muted font-body">Không có nhân viên</p>
        </div>
      </div>
    </div>

    <!-- Footer: store count -->
    <div v-if="!isCollapsed && !isLoading && employees.length > 0" class="px-4 py-3 bg-ink-medium/30 relative before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-border-subtle/70 before:to-transparent">
      <div class="flex items-center justify-between text-xs text-paper-muted font-body">
        <span>{{ employees.length }} nhân viên</span>
        <span>{{ employeesByStore.size }} cửa hàng</span>
      </div>
    </div>
  </aside>
</template>
