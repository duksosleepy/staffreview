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
  switch (role) {
    case 'asm':
      return 'bg-gradient-to-r from-gold-500/20 to-gold-600/20 text-gold-300 border border-gold-500/30';
    case 'cht':
      return 'bg-gradient-to-r from-vermillion-500/20 to-vermillion-600/20 text-vermillion-300 border border-vermillion-500/30';
    default:
      return 'bg-gradient-to-r from-paper-muted/20 to-paper-dim/20 text-paper-muted border border-paper-muted/30';
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
    class="h-full flex flex-col border-r border-gradient-vermillion/20 bg-gradient-to-b from-ink-deep/90 via-ink-medium/80 to-ink-light/70 transition-all duration-500 shadow-xl relative overflow-hidden"
    :class="isCollapsed ? 'w-16' : 'w-80'"
  >
    <!-- Animated background elements -->
    <div class="absolute inset-0 overflow-hidden">
      <div class="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-vermillion-500/5 blur-2xl animate-pulse"></div>
      <div class="absolute bottom-1/3 right-1/4 w-40 h-40 rounded-full bg-gold-500/5 blur-2xl animate-pulse delay-1000"></div>
    </div>

    <!-- Sidebar Header -->
    <div class="flex items-center px-4 py-4 border-b border-gradient-vermillion/20 relative z-10 bg-gradient-to-r from-ink-medium/80 to-ink-deep/80 backdrop-blur-xl shadow-inner" :class="isCollapsed ? 'justify-center' : 'justify-between'">
      <div v-if="!isCollapsed" class="flex items-center gap-3 min-w-0 animate-bureau-slide-right">
        <div class="p-2.5 rounded-xl bg-gradient-to-br from-vermillion-600 to-vermillion-700 shadow-lg shadow-vermillion-500/20">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div class="min-w-0">
          <span class="text-base font-display font-normal text-paper-white truncate">Nhân Viên</span>
          <p class="text-xs text-paper-muted truncate font-body">Quản lý nhân sự</p>
        </div>
      </div>
      <button
        class="p-2.5 rounded-xl hover:bg-vermillion-500/10 text-paper-muted hover:text-vermillion-400 transition-all duration-300 group flex items-center justify-center"
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
        class="p-3.5 rounded-xl hover:bg-vermillion-500/10 text-paper-muted hover:text-vermillion-400 transition-all duration-300 group animate-pulse"
        title="Danh sách nhân viên"
        @click="isCollapsed = false"
      >
        <svg class="w-6 h-6 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>

    <!-- Expanded state: employee list -->
    <div v-else class="flex-1 overflow-y-auto py-4 relative z-10">
      <!-- Loading -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-12 animate-bureau-fade">
        <div class="w-10 h-10 border-4 border-vermillion-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p class="text-sm text-paper-muted font-body">Đang tải dữ liệu...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="px-4 py-6 text-center animate-bureau-fade">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-vermillion-500/10 mb-3">
          <svg class="w-6 h-6 text-vermillion-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p class="text-sm text-vermillion-400 mb-3 font-body">{{ error }}</p>
        <button
          class="px-4 py-2 text-sm font-body text-vermillion-400 hover:text-vermillion-300 hover:bg-vermillion-500/10 rounded-lg transition-colors border border-vermillion-500/20"
          @click="loadEmployees"
        >
          Thử lại
        </button>
      </div>

      <!-- Employee List grouped by store -->
      <div v-else class="space-y-5 animate-bureau-enter">
        <div v-for="[storeName, storeEmployees] in employeesByStore" :key="storeName" class="px-2">
          <!-- Store header -->
          <div class="px-4 py-3 flex items-center gap-3 mb-2.5 bg-gradient-to-r from-vermillion-500/5 to-transparent rounded-xl mx-1 border border-vermillion-500/10">
            <div class="p-2.5 rounded-lg bg-gradient-to-br from-vermillion-600/20 to-vermillion-700/20 shadow-inner">
              <svg class="w-4 h-4 text-vermillion-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div class="flex-1">
              <span class="text-sm font-body font-semibold text-vermillion-300 uppercase tracking-wide">{{ storeName }}</span>
              <span class="text-xs text-paper-muted ml-2 font-body">({{ storeEmployees.length }})</span>
            </div>
          </div>

          <!-- Employees in this store -->
          <div class="space-y-1.5">
            <div
              v-for="(emp, index) in storeEmployees"
              :key="emp.id"
              class="mx-2 px-4 py-3.5 rounded-xl transition-all duration-300 cursor-pointer group hover:shadow-xl border border-transparent relative overflow-hidden"
              :class="selectedId === emp.id
                ? 'bg-gradient-to-r from-vermillion-500/15 to-vermillion-600/10 border border-vermillion-500/40 shadow-lg animate-stamp'
                : 'hover:bg-gradient-vermillion/10 border-transparent'"
              :style="{ animationDelay: `${index * 50}ms` }"
              @click="selectEmployee(emp)"
            >
              <div class="flex items-center gap-3.5 relative z-10">
                <!-- Avatar -->
                <div
                  class="w-11 h-11 rounded-lg flex items-center justify-center text-white text-sm font-semibold shrink-0 shadow-md transition-all duration-300"
                  :class="selectedId === emp.id
                    ? 'bg-gradient-to-br from-vermillion-500 to-vermillion-600 ring-2 ring-vermillion-400/50'
                    : 'bg-gradient-to-br from-ink-lighter to-ink-faint'"
                >
                  {{ emp.displayName.charAt(0).toUpperCase() }}
                </div>
                <!-- Info -->
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-body font-medium truncate" :class="selectedId === emp.id ? 'text-vermillion-300' : 'text-paper-white'">{{ emp.displayName }}</span>
                    <span
                      class="text-[10px] px-2 py-1 rounded-full font-body font-medium uppercase shrink-0"
                      :class="roleBadgeClass(getEffectiveRole(emp))"
                    >
                      {{ roleDisplay(getEffectiveRole(emp)) }}
                    </span>
                  </div>
                  <p v-if="emp.casdoor_id" class="text-xs text-paper-muted truncate mt-1 font-body">
                    ID: {{ emp.casdoor_id }}
                  </p>
                </div>
              </div>
              <!-- Subtle background effect -->
              <div class="absolute inset-0 bg-gradient-to-r from-transparent via-vermillion-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"></div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="employeesByStore.size === 0 && !isLoading" class="px-4 py-12 text-center animate-bureau-fade">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-ink-lighter mb-4">
            <svg class="w-8 h-8 text-paper-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p class="text-sm text-paper-muted mb-1 font-body">Không có nhân viên</p>
          <p class="text-xs text-paper-dim font-body">Dữ liệu sẽ được cập nhật khi có nhân viên mới</p>
        </div>
      </div>
    </div>

    <!-- Footer: store count -->
    <div v-if="!isCollapsed && !isLoading && employees.length > 0" class="px-4 py-3 border-t border-gradient-vermillion/10 bg-gradient-to-r from-ink-medium/60 to-ink-light/60 relative z-10">
      <div class="flex items-center justify-between text-xs text-paper-muted font-body">
        <span>{{ employees.length }} nhân viên</span>
        <span>{{ employeesByStore.size }} cửa hàng</span>
      </div>
    </div>
  </aside>
</template>
