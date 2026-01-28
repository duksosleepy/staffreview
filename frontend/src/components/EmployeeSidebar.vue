<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
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
  switch (role) {
    case 'asm':
      return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    case 'cht':
      return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
    default:
      return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  }
};

// Map role codes to display names for consistency with UserMenu
const roleDisplay = computed(() => {
  const roleMap: Record<string, string> = {
    asm: "Area Manager",
    cht: "Team Lead",
    employee: "Employee",
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
    class="h-full flex flex-col border-r border-white/10 bg-[#1e1b24] transition-all duration-300 shadow-lg"
    :class="isCollapsed ? 'w-16' : 'w-72'"
  >
    <!-- Sidebar Header -->
    <div class="flex items-center px-4 py-4 border-b border-white/10 bg-gradient-to-r from-[#26232b]/50 to-[#1e1b24]" :class="isCollapsed ? 'justify-center' : 'justify-between'">
      <div v-if="!isCollapsed" class="flex items-center gap-3 min-w-0">
        <div class="p-2 rounded-lg bg-gradient-to-br from-teal-600 to-teal-700 shadow-md">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div class="min-w-0">
          <span class="text-base font-semibold text-white truncate">Nhân Viên</span>
          <p class="text-xs text-gray-400 truncate">Quản lý nhân sự</p>
        </div>
      </div>
      <button
        class="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all duration-200 group flex items-center justify-center"
        @click="isCollapsed = !isCollapsed"
      >
        <svg class="w-5 h-5 transition-transform duration-300 group-hover:scale-110" :class="isCollapsed ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      </button>
    </div>

    <!-- Collapsed state: just show icon -->
    <div v-if="isCollapsed" class="flex-1 flex flex-col items-center justify-center pt-4 gap-3">
      <button
        class="p-3 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all duration-200 group"
        title="Danh sách nhân viên"
        @click="isCollapsed = false"
      >
        <svg class="w-6 h-6 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>

    <!-- Expanded state: employee list -->
    <div v-else class="flex-1 overflow-y-auto py-4">
      <!-- Loading -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-12">
        <div class="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p class="text-sm text-gray-400">Đang tải dữ liệu...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="px-4 py-6 text-center">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mb-3">
          <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p class="text-sm text-red-400 mb-2">{{ error }}</p>
        <button
          class="px-4 py-2 text-sm text-teal-400 hover:text-teal-300 hover:bg-teal-500/10 rounded-lg transition-colors"
          @click="loadEmployees"
        >
          Thử lại
        </button>
      </div>

      <!-- Employee List grouped by store -->
      <div v-else class="space-y-4">
        <div v-for="[storeName, storeEmployees] in employeesByStore" :key="storeName" class="px-2">
          <!-- Store header -->
          <div class="px-4 py-2 flex items-center gap-3 mb-2">
            <div class="p-1.5 rounded-lg bg-gray-700/50">
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div class="flex-1">
              <span class="text-sm font-semibold text-gray-300 uppercase tracking-wide">{{ storeName }}</span>
              <span class="text-xs text-gray-500 ml-2">({{ storeEmployees.length }})</span>
            </div>
          </div>

          <!-- Employees in this store -->
          <div class="space-y-1">
            <div
              v-for="emp in storeEmployees"
              :key="emp.id"
              class="mx-2 px-3 py-3 rounded-xl transition-all duration-200 cursor-pointer group hover:shadow-md"
              :class="selectedId === emp.id
                ? 'bg-gradient-to-r from-teal-500/15 to-teal-600/10 border border-teal-500/30 shadow-md'
                : 'hover:bg-white/5 border border-transparent'"
              @click="selectEmployee(emp)"
            >
              <div class="flex items-center gap-3">
                <!-- Avatar -->
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 shadow-md"
                  :class="selectedId === emp.id
                    ? 'bg-gradient-to-br from-teal-400 to-teal-500 ring-2 ring-teal-400/50'
                    : 'bg-gradient-to-br from-teal-600 to-teal-700'"
                >
                  {{ emp.displayName.charAt(0).toUpperCase() }}
                </div>
                <!-- Info -->
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium truncate" :class="selectedId === emp.id ? 'text-teal-300' : 'text-white'">{{ emp.displayName }}</span>
                    <span
                      class="text-[11px] px-2 py-0.5 rounded-full font-medium uppercase shrink-0"
                      :class="roleBadgeClass(getEffectiveRole(emp))"
                    >
                      {{ roleDisplay(getEffectiveRole(emp)) }}
                    </span>
                  </div>
                  <p v-if="emp.casdoor_id" class="text-xs text-gray-500 truncate mt-1">
                    ID: {{ emp.casdoor_id }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="employeesByStore.size === 0 && !isLoading" class="px-4 py-12 text-center">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-700/30 mb-4">
            <svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p class="text-sm text-gray-500 mb-1">Không có nhân viên</p>
          <p class="text-xs text-gray-600">Dữ liệu sẽ được cập nhật khi có nhân viên mới</p>
        </div>
      </div>
    </div>

    <!-- Footer: store count -->
    <div v-if="!isCollapsed && !isLoading && employees.length > 0" class="px-4 py-3 border-t border-white/10 bg-[#1e1b24]/50">
      <div class="flex items-center justify-between text-xs text-gray-500">
        <span>{{ employees.length }} nhân viên</span>
        <span>{{ employeesByStore.size }} cửa hàng</span>
      </div>
    </div>
  </aside>
</template>
