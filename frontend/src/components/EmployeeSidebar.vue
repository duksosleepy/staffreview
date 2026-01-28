<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchStoreEmployees, type StoreEmployee } from '@/lib/gel-client';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();

const emit = defineEmits<(e: 'select', employee: StoreEmployee | null) => void>();

const employees = ref<StoreEmployee[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const isCollapsed = ref(false);
const selectedId = ref<string | null>(null);

// Group employees by store
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

const roleBadgeClass = (role: string) => {
  const normalizedRole = role.toLowerCase();
  switch (normalizedRole) {
    case 'asm':
      return 'bg-gold-500 text-white border border-gold-600'; // Highest role - strongest color
    case 'cht':
      return 'bg-vermillion-500 text-white border border-vermillion-600'; // Medium role
    case 'employee':
      return 'bg-sky-500 text-white border border-sky-600'; // Base role
    default:
      return 'bg-ink-lighter text-paper-muted border border-ink-faint';
  }
};

// Map role codes to display names for consistency with UserMenu
const roleDisplay = computed(() => {
  const roleMap: Record<string, string> = {
    asm: 'ASM',
    cht: 'CHT',
    employee: 'Employee',
  };

  return (role: string) => roleMap[role.toLowerCase()] || role;
});

// Get the effective role for an employee, correcting for cases where the current user's role is incorrectly reported
const getEffectiveRole = (employee: StoreEmployee) => {
  // If this employee is the current user, use the current user's actual role
  if (employee.casdoor_id === auth.casdoorId) {
    return auth.role || employee.role;
  }
  return employee.role;
};

const selectEmployee = (emp: StoreEmployee) => {
  if (selectedId.value === emp.id) {
    // Deselect — go back to viewing all
    selectedId.value = null;
    emit('select', null);
  } else {
    selectedId.value = emp.id;
    emit('select', emp);
  }
};

const loadEmployees = async () => {
  isLoading.value = true;
  error.value = null;
  try {
    employees.value = await fetchStoreEmployees();
  } catch (e) {
    error.value = 'Không thể tải danh sách nhân viên';
    console.error('Failed to load employees:', e);
  } finally {
    isLoading.value = false;
  }
};

onMounted(loadEmployees);
</script>

<template>
  <aside
    class="h-full flex flex-col border-r bg-ink-deep transition-all duration-300 relative"
    :class="isCollapsed ? 'w-16' : 'w-72'"
    style="border-right-color: var(--border-strong);"
  >
    <!-- Sidebar Header -->
    <div class="flex items-center px-4 py-4 border-b relative" :class="isCollapsed ? 'justify-center' : 'justify-between'" style="border-bottom-color: var(--border-medium);">
      <div v-if="!isCollapsed" class="flex items-center gap-2.5 min-w-0">
        <svg class="w-5 h-5 text-vermillion-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <div class="min-w-0 flex-1">
          <h2 class="text-sm font-medium text-paper-white truncate font-body">Nhân viên</h2>
          <p class="text-xs text-paper-muted truncate font-body">{{ employees.length }} người</p>
        </div>
      </div>
      <button
        class="p-2 rounded-lg hover:bg-ink-lighter text-paper-muted hover:text-paper-white transition-all duration-200"
        @click="isCollapsed = !isCollapsed"
      >
        <svg class="w-4 h-4 transition-transform duration-200" :class="isCollapsed ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </div>

    <!-- Collapsed state: just show icon -->
    <div v-if="isCollapsed" class="flex-1 flex flex-col items-center pt-6 gap-3">
    </div>

    <!-- Expanded state: employee list -->
    <div v-else class="flex-1 overflow-y-auto">
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
          class="px-3 py-1.5 text-sm font-body text-vermillion-400 hover:bg-vermillion-500/10 rounded-lg transition-colors border border-vermillion-500/20"
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
            <div
              v-for="emp in storeEmployees"
              :key="emp.id"
              class="px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer group border"
              :class="selectedId === emp.id
                ? 'bg-vermillion-500/10 border-vermillion-500/40'
                : 'hover:bg-ink-lighter border-transparent'"
              @click="selectEmployee(emp)"
            >
              <div class="flex items-center gap-3">
                <!-- Avatar -->
                <div
                  class="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-semibold shrink-0 transition-all duration-200"
                  :class="selectedId === emp.id
                    ? 'bg-vermillion-500'
                    : 'bg-ink-lighter'"
                >
                  {{ emp.displayName.charAt(0).toUpperCase() }}
                </div>
                <!-- Info -->
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2 mb-0.5">
                    <span class="text-sm font-medium truncate" :class="selectedId === emp.id ? 'text-vermillion-300' : 'text-paper-white'">{{ emp.displayName }}</span>
                    <span
                      class="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase shrink-0"
                      :class="roleBadgeClass(getEffectiveRole(emp))"
                    >
                      {{ roleDisplay(getEffectiveRole(emp)) }}
                    </span>
                  </div>
                  <p v-if="emp.casdoor_id" class="text-[10px] text-paper-muted truncate font-body">
                    ID: {{ emp.casdoor_id }}
                  </p>
                </div>
              </div>
            </div>
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
    <div v-if="!isCollapsed && !isLoading && employees.length > 0" class="px-4 py-3 border-t bg-ink-medium/30" style="border-top-color: var(--border-subtle);">
      <div class="flex items-center justify-between text-xs text-paper-muted font-body">
        <span>{{ employees.length }} nhân viên</span>
        <span>{{ employeesByStore.size }} cửa hàng</span>
      </div>
    </div>
  </aside>
</template>
