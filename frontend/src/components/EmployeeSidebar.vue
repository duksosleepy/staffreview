<script setup lang="ts">
import { useAsyncState, useLocalStorage, useMagicKeys, whenever } from '@vueuse/core';
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue';
import ChevronIcon from '@/components/icons/ChevronIcon.vue';
import { useRoleDisplay } from '@/composables/useRoleDisplay';
import { FOCUS_RING_CLASSES } from '@/constants/ui';
import { fetchStoreEmployees, type StoreEmployee } from '@/lib/gel-client';
import { useAuthStore } from '@/stores/auth';

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
const { getRoleDisplay, getRoleBadgeClass } = useRoleDisplay();

// Extract reactive values to ensure proper re-computation
const currentUserStores = computed(() => auth.stores);
const currentUserId = computed(() => auth.casdoorId);

const emit = defineEmits<{
  select: [employee: StoreEmployee | null];
}>();

// Search functionality
const searchQuery = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);

// Keyboard shortcut to focus search
const { Slash } = useMagicKeys();
whenever(Slash, () => {
  if (!isCollapsed.value) {
    searchInputRef.value?.focus();
    return false; // Prevent default
  }
});

// Persist sidebar collapse state
const isCollapsed = useLocalStorage('sidebar-collapsed', false);
const collapsedStores = useLocalStorage<string[]>('sidebar-collapsed-stores', []);
const selectedId = shallowRef<string | null>(props.initialSelectedId || null);

// Use shallowRef for better performance with large arrays
const {
  state: employees,
  isLoading,
  error: asyncError,
  execute: loadEmployees,
} = useAsyncState(() => fetchStoreEmployees(), [], {
  immediate: false,
  onError: (e) => {
    console.error('Failed to load employees:', e);
  },
});

const error = computed(() => (asyncError.value ? 'Không thể tải danh sách nhân viên' : null));

/**
 * Get the effective role for an employee
 */
const getEffectiveRole = (employee: StoreEmployee): string => {
  if (employee.casdoor_id === auth.casdoorId) {
    return auth.role || employee.role;
  }
  return employee.role;
};

/**
 * Toggle store section collapse
 */
const toggleStoreCollapse = (storeName: string) => {
  const index = collapsedStores.value.indexOf(storeName);
  if (index > -1) {
    collapsedStores.value.splice(index, 1);
  } else {
    collapsedStores.value.push(storeName);
  }
};

/**
 * Check if store is collapsed
 */
const isStoreCollapsed = (storeName: string) => {
  return collapsedStores.value.includes(storeName);
};

/**
 * Group employees by store
 */
const employeesByStore = computed(() => {
  const userStores = currentUserStores.value;
  const userId = currentUserId.value;
  const userRole = auth.role;
  const grouped = new Map<string, StoreEmployee[]>();

  for (const emp of employees.value) {
    // RBAC: CHT users should not see ASM users
    const empRole = getEffectiveRole(emp);
    if (userRole === 'cht' && empRole === 'asm') {
      continue;
    }

    for (const store of emp.stores) {
      if (userStores.includes(store)) {
        if (!grouped.has(store)) {
          grouped.set(store, []);
        }
        grouped.get(store)?.push(emp);
      }
    }
  }

  // Role hierarchy: ASM > CHT > Employee
  const roleLevel: Record<string, number> = { asm: 3, cht: 2, employee: 1 };

  // Sort each store's employees by role level (high to low), then current user first, then alphabetically
  for (const emps of grouped.values()) {
    emps.sort((a, b) => {
      const aRole = getEffectiveRole(a);
      const bRole = getEffectiveRole(b);

      const roleDiff = (roleLevel[bRole] ?? 0) - (roleLevel[aRole] ?? 0);
      if (roleDiff !== 0) return roleDiff;

      const aIsCurrent = a.casdoor_id === userId;
      const bIsCurrent = b.casdoor_id === userId;
      if (aIsCurrent && !bIsCurrent) return -1;
      if (!aIsCurrent && bIsCurrent) return 1;

      return a.displayName.localeCompare(b.displayName);
    });
  }

  return grouped;
});

/**
 * Filtered employees by search query
 */
const filteredEmployeesByStore = computed(() => {
  if (!searchQuery.value.trim()) {
    return employeesByStore.value;
  }

  const query = searchQuery.value.toLowerCase().trim();
  const filtered = new Map<string, StoreEmployee[]>();

  for (const [storeName, emps] of employeesByStore.value) {
    const matching = emps.filter(
      (emp) => emp.displayName.toLowerCase().includes(query) || getEffectiveRole(emp).toLowerCase().includes(query),
    );
    if (matching.length > 0) {
      filtered.set(storeName, matching);
    }
  }

  return filtered;
});

/**
 * Select an employee from the list
 */
const selectEmployee = (emp: StoreEmployee) => {
  if (selectedId.value === emp.id) {
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

/**
 * Auto-select current user after employees are loaded
 */
const autoSelectCurrentUser = () => {
  const currentUser = employees.value.find((emp) => emp.casdoor_id === currentUserId.value);
  if (currentUser && !selectedId.value) {
    selectedId.value = currentUser.id;
    emit('select', currentUser);
  }
};

onMounted(async () => {
  await loadEmployees();
  autoSelectCurrentUser();
});

// Keyboard navigation - optimized for performance
const handleKeydown = (event: KeyboardEvent) => {
  // Early returns for better performance
  if (isCollapsed.value) return;
  if (document.activeElement === searchInputRef.value) return;

  // Only handle specific keys to avoid unnecessary processing
  const { key } = event;
  if (!['ArrowDown', 'ArrowUp', 'Escape', 'Enter'].includes(key)) return;

  if (key === 'Escape') {
    searchQuery.value = '';
    searchInputRef.value?.blur();
    return;
  }

  if (key === 'ArrowDown' || key === 'ArrowUp') {
    event.preventDefault();

    // Cache the flattened array to avoid recreating on every keypress
    const allEmployees = Array.from(filteredEmployeesByStore.value.values()).flat();
    const currentIndex = allEmployees.findIndex((emp) => emp.id === selectedId.value);

    if (key === 'ArrowDown') {
      const nextIndex = currentIndex < allEmployees.length - 1 ? currentIndex + 1 : 0;
      if (allEmployees[nextIndex]) {
        selectEmployee(allEmployees[nextIndex]);
      }
    } else {
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : allEmployees.length - 1;
      if (allEmployees[prevIndex]) {
        selectEmployee(allEmployees[prevIndex]);
      }
    }
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});

// Computed totals
const totalEmployees = computed(() => employees.value.length);
const totalStores = computed(() => employeesByStore.value.size);
</script>

<style scoped>
.sidebar-search-input {
  width: 100%;
  background-color: rgba(39, 39, 37, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  padding-left: 2.75rem;
  padding-right: 3rem;
  padding-top: 0.625rem;
  padding-bottom: 0.625rem;
  font-size: 0.875rem;
  color: #F2ECE2;
  transition: all 0.15s ease;
}

.sidebar-search-input::placeholder {
  color: rgba(138, 127, 114, 0.7);
  opacity: 1;
}

.sidebar-search-input:focus {
  outline: none;
  border-color: rgba(216, 74, 58, 0.5);
  background-color: rgba(39, 39, 37, 0.5);
}

/* Indicator dot without animations for instant feedback */
.indicator-dot {
  width: 6px;
  height: 6px;
  background-color: transparent;
}

.indicator-dot.active {
  height: 20px;
  background-color: rgb(216, 74, 58);
  box-shadow: 0 4px 12px rgba(216, 74, 58, 0.3);
}

/* Sidebar toggle button */
.sidebar-toggle-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background-color: transparent;
  color: #8A7F72;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
  outline: none;
  flex-shrink: 0;
}

.sidebar-toggle-btn:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: #F2ECE2;
}

.sidebar-toggle-btn:active {
  background-color: rgba(255, 255, 255, 0.08);
  transform: scale(0.95);
}

.sidebar-toggle-btn svg {
  width: 18px;
  height: 18px;
  transition: transform 0.15s ease;
}

/* Collapsed state - centered toggle */
.sidebar-collapsed-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px;
  border-t: 1px solid rgba(255, 255, 255, 0.05);
}
</style>

<template>
  <aside
    class="h-full flex flex-col bg-ink-deep border-r border-white/5 relative transition-[width] duration-200"
    :class="isCollapsed ? 'w-16' : 'w-72'"
  >
    <!-- Header with Search (only when expanded) -->
    <div v-if="!isCollapsed" class="p-3 border-b border-white/5">
      <div class="relative flex-1 min-w-0">
        <div class="relative flex items-center">
          <!-- Search Icon -->
          <svg
            class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-paper-muted transition-colors duration-150 shrink-0 z-10 pointer-events-none"
            :class="searchQuery ? 'text-vermillion-400' : ''"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>

          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            placeholder="Tìm nhân viên..."
            class="sidebar-search-input"
            aria-label="Tìm kiếm nhân viên"
          />
        </div>

        <!-- Right side actions -->
        <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
          <!-- Clear button -->
          <button
            v-if="searchQuery"
            class="p-1 text-paper-muted hover:text-paper-white transition-colors duration-150 pointer-events-auto"
            @click="searchQuery = ''"
            aria-label="Xóa tìm kiếm"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <!-- Keyboard shortcut hint -->
          <kbd
            v-if="!searchQuery"
            class="px-1.5 py-0.5 text-[10px] text-paper-muted bg-ink-light rounded border border-white/10 font-mono"
          >
            /
          </kbd>
        </div>
      </div>
    </div>

    <!-- Content Area (Expanded only) -->
    <div v-if="!isCollapsed" class="flex-1 overflow-y-auto">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-16">
        <div class="w-6 h-6 border-2 border-white/10 border-t-vermillion-500 rounded-full animate-spin mb-3"></div>
        <p class="text-xs text-paper-muted">Đang tải...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="px-4 py-8 text-center">
        <div class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-vermillion-500/10 mb-3">
          <svg class="w-4 h-4 text-vermillion-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p class="text-xs text-vermillion-400 mb-3">{{ error }}</p>
        <button
          :class="`px-4 py-1.5 text-xs text-vermillion-400 hover:bg-vermillion-500/10 rounded-lg transition-colors duration-150 border border-vermillion-500/20 ${FOCUS_RING_CLASSES}`"
          @click="loadEmployees()"
        >
          Thử lại
        </button>
      </div>

      <!-- Employee List grouped by store -->
      <div v-else-if="filteredEmployeesByStore.size > 0" class="p-2">
        <div v-for="[storeName, storeEmployees] in filteredEmployeesByStore" :key="storeName" class="mb-4">
          <!-- Store Header - Collapsible with improved hit area -->
          <button
            class="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium uppercase tracking-wider text-paper-white hover:text-paper-white/80 transition-colors duration-150 rounded-lg hover:bg-ink-lighter/50 group"
            @click="toggleStoreCollapse(storeName)"
            :aria-expanded="!isStoreCollapsed(storeName)"
          >
            <!-- Larger chevron with better visual hierarchy -->
            <div class="shrink-0 w-5 h-5 flex items-center justify-center">
              <ChevronIcon
                :direction="isStoreCollapsed(storeName) ? 'right' : 'down'"
                class="w-4 h-4 transition-transform duration-200 ease-out group-hover:scale-110"
              />
            </div>
            <span class="truncate flex-1 text-left">{{ storeName }}</span>
            <span class="text-[10px] text-paper-muted shrink-0 px-1.5 py-0.5 rounded bg-ink-lighter/50">{{ storeEmployees.length }}</span>
          </button>

          <!-- Employee List -->
          <div
            v-show="!isStoreCollapsed(storeName)"
            class="space-y-0.5 mt-0.5 ml-2 pl-3"
          >
            <button
              v-for="emp in storeEmployees"
              :key="emp.id"
              type="button"
              :class="[
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left',
                'transition-colors duration-150',
                FOCUS_RING_CLASSES,
                selectedId === emp.id
                  ? 'bg-vermillion-500/10 text-vermillion-200'
                  : 'hover:bg-ink-lighter/70 text-paper-muted hover:text-paper-light'
              ]"
              :aria-pressed="selectedId === emp.id"
              :aria-label="`${emp.displayName}, ${getRoleDisplay(getEffectiveRole(emp))}`"
              @click="selectEmployee(emp)"
            >
              <!-- Optimized Indicator Dot with CSS-only animation -->
              <div class="shrink-0 w-1.5 h-5 flex items-center">
                <div
                  :class="[
                    'indicator-dot rounded-full',
                    selectedId === emp.id ? 'active' : ''
                  ]"
                ></div>
              </div>

              <!-- Avatar -->
              <div
                :class="[
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0',
                  'transition-colors duration-150',
                  selectedId === emp.id
                    ? 'bg-vermillion-500 text-white'
                    : 'bg-ink-lighter text-paper-light'
                ]"
              >
                {{ emp.displayName.charAt(0).toUpperCase() }}
              </div>

              <!-- Info -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <span
                    class="text-xs truncate transition-colors duration-150"
                    :title="emp.displayName"
                  >
                    {{ emp.displayName }}
                  </span>
                  <span
                    class="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                    :class="getRoleBadgeClass(getEffectiveRole(emp))"
                    :title="`Vai trò: ${getRoleDisplay(getEffectiveRole(emp))}`"
                  >
                    {{ getRoleDisplay(getEffectiveRole(emp)) }}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Empty Search State -->
      <div v-else-if="searchQuery && filteredEmployeesByStore.size === 0" class="px-4 py-12 text-center">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-ink-lighter/50 mb-3">
          <svg class="w-5 h-5 text-paper-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <p class="text-sm text-paper-muted">Không tìm thấy</p>
        <p class="text-xs text-paper-muted mt-1">"{{ searchQuery }}" không khớp với nhân viên nào</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="employeesByStore.size === 0" class="px-4 py-12 text-center">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-ink-lighter/50 mb-3">
          <svg class="w-5 h-5 text-paper-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p class="text-sm text-paper-muted">Không có nhân viên</p>
      </div>
    </div>

    <!-- Spacer for collapsed state to push button to bottom -->
    <div v-if="isCollapsed" class="flex-1"></div>

    <!-- Footer with Toggle Button (Expanded) -->
    <div
      v-if="!isCollapsed && !isLoading && totalEmployees > 0"
      class="px-4 py-2.5 bg-ink-medium/30 border-t border-white/5 flex items-center justify-between"
    >
      <div class="flex items-center gap-3 text-[11px] text-paper-muted">
        <span>{{ totalEmployees }} nhân viên</span>
        <span>{{ totalStores }} cửa hàng</span>
      </div>
      <button
        class="sidebar-toggle-btn"
        @click="isCollapsed = true"
        title="Thu gọn thanh bên"
        aria-label="Thu gọn thanh bên"
        :aria-expanded="!isCollapsed"
      >
        <svg
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          stroke-width="2"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      </button>
    </div>

    <!-- Footer with Toggle Button (Collapsed) -->
    <div v-if="isCollapsed" class="sidebar-collapsed-footer">
      <button
        class="sidebar-toggle-btn"
        @click="isCollapsed = false"
        title="Mở rộng thanh bên"
        aria-label="Mở rộng thanh bên"
        :aria-expanded="!isCollapsed"
      >
        <svg
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          stroke-width="2"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      </button>
    </div>
  </aside>
</template>
