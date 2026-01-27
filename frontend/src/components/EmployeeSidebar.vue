<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { fetchStoreEmployees, type StoreEmployee } from '@/lib/gel-client';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();

const emit = defineEmits<{
  (e: 'select', employee: StoreEmployee | null): void;
}>();

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
    error.value = 'Khong the tai danh sach nhan vien';
    console.error('Failed to load employees:', e);
  } finally {
    isLoading.value = false;
  }
};

onMounted(loadEmployees);
</script>

<template>
  <aside
    class="h-full flex flex-col border-r border-white/10 bg-[#1e1b24] transition-all duration-300"
    :class="isCollapsed ? 'w-12' : 'w-64'"
  >
    <!-- Sidebar Header -->
    <div class="flex items-center justify-between px-3 py-3 border-b border-white/10">
      <div v-if="!isCollapsed" class="flex items-center gap-2 min-w-0">
        <svg class="w-4 h-4 text-teal-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span class="text-sm font-semibold text-white truncate">Nhan vien</span>
      </div>
      <button
        class="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors shrink-0"
        @click="isCollapsed = !isCollapsed"
      >
        <svg class="w-4 h-4 transition-transform" :class="isCollapsed ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      </button>
    </div>

    <!-- Collapsed state: just show icon -->
    <div v-if="isCollapsed" class="flex-1 flex flex-col items-center pt-3 gap-2">
      <button
        class="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        title="Nhan vien"
        @click="isCollapsed = false"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>

    <!-- Expanded state: employee list -->
    <div v-else class="flex-1 overflow-y-auto">
      <!-- Loading -->
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <div class="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="px-3 py-4 text-center">
        <p class="text-xs text-red-400">{{ error }}</p>
        <button
          class="mt-2 text-xs text-teal-400 hover:text-teal-300 underline"
          @click="loadEmployees"
        >
          Thu lai
        </button>
      </div>

      <!-- Employee List grouped by store -->
      <div v-else class="py-2">
        <div v-for="[storeName, storeEmployees] in employeesByStore" :key="storeName" class="mb-2">
          <!-- Store header -->
          <div class="px-3 py-1.5 flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider">{{ storeName }}</span>
            <span class="text-[10px] text-gray-500 ml-auto">({{ storeEmployees.length }})</span>
          </div>

          <!-- Employees in this store -->
          <div
            v-for="emp in storeEmployees"
            :key="emp.id"
            class="mx-2 px-2 py-2 rounded-lg transition-colors cursor-pointer group"
            :class="selectedId === emp.id
              ? 'bg-teal-500/15 border border-teal-500/30'
              : 'hover:bg-white/5 border border-transparent'"
            @click="selectEmployee(emp)"
          >
            <div class="flex items-center gap-2.5">
              <!-- Avatar -->
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                :class="selectedId === emp.id
                  ? 'bg-gradient-to-br from-teal-400 to-teal-500 ring-2 ring-teal-400/50'
                  : 'bg-gradient-to-br from-teal-600 to-teal-700'"
              >
                {{ emp.displayName.charAt(0).toUpperCase() }}
              </div>
              <!-- Info -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="text-sm font-medium truncate" :class="selectedId === emp.id ? 'text-teal-300' : 'text-white'">{{ emp.displayName }}</span>
                  <span
                    class="text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase shrink-0"
                    :class="roleBadgeClass(emp.role)"
                  >
                    {{ emp.role }}
                  </span>
                </div>
                <p v-if="emp.casdoor_id" class="text-[11px] text-gray-500 truncate mt-0.5">
                  ID: {{ emp.casdoor_id }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="employeesByStore.size === 0 && !isLoading" class="px-3 py-8 text-center">
          <svg class="w-10 h-10 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p class="text-xs text-gray-500">Khong co nhan vien</p>
        </div>
      </div>
    </div>

    <!-- Footer: store count -->
    <div v-if="!isCollapsed && !isLoading && employees.length > 0" class="px-3 py-2 border-t border-white/10">
      <p class="text-[10px] text-gray-500 text-center">
        {{ employees.length }} nhan vien &middot; {{ employeesByStore.size }} cua hang
      </p>
    </div>
  </aside>
</template>
