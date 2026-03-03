<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRoleDisplay } from '@/composables/useRoleDisplay';

defineOptions({
  name: 'CurrentUserWidget',
});

const emit = defineEmits<{
  click: [];
}>();

const auth = useAuthStore();
const { getRoleDisplay, getRoleBadgeClass } = useRoleDisplay();

const currentUserDisplayName = computed(() => auth.userDisplayName);
const currentUserRole = computed(() => auth.role || 'employee');
const currentUserStores = computed(() => auth.stores);

// Get the first letter for avatar
const avatarLetter = computed(() => {
  const name = currentUserDisplayName.value;
  return name ? name.charAt(0).toUpperCase() : '?';
});

// Format stores display
const storesDisplay = computed(() => {
  const stores = currentUserStores.value;
  if (stores.length === 0) return 'Không có cửa hàng';
  if (stores.length === 1) return stores[0];
  if (stores.length === 2) return stores.join(', ');
  return `${stores[0]}, ${stores[1]} +${stores.length - 2}`;
});
</script>

<style scoped>
.user-widget {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(220, 38, 38, 0.05) 100%);
  border: 1.5px solid rgba(239, 68, 68, 0.15);
  border-radius: 12px;
  padding: 14px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.user-widget:hover {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(220, 38, 38, 0.08) 100%);
  border-color: rgba(239, 68, 68, 0.25);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1);
}

.user-widget:active {
  transform: scale(0.98);
}

.user-avatar {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, var(--vermillion-500) 0%, var(--vermillion-600) 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.25);
}

.user-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--paper-white);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-stores {
  font-size: 11px;
  color: var(--paper-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 4px;
}

.store-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.user-badge-wrapper {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
</style>

<template>
  <button
    type="button"
    class="user-widget w-full text-left"
    @click="emit('click')"
    title="Nhấn để xem bảng công việc của bạn"
  >
    <div class="flex items-center gap-3">
      <!-- Avatar -->
      <div class="user-avatar">
        {{ avatarLetter }}
      </div>

      <!-- User Info -->
      <div class="user-info">
        <div class="user-name" :title="currentUserDisplayName">
          {{ currentUserDisplayName }}
        </div>
        <div class="user-stores" :title="currentUserStores.join(', ')">
          <svg class="store-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <span>{{ storesDisplay }}</span>
        </div>
      </div>

      <!-- Role Badge -->
      <div class="user-badge-wrapper">
        <span
          class="text-[10px] px-2 py-1 rounded font-semibold shrink-0"
          :class="getRoleBadgeClass(currentUserRole)"
          :title="`Vai trò: ${getRoleDisplay(currentUserRole)}`"
        >
          {{ getRoleDisplay(currentUserRole) }}
        </span>
      </div>
    </div>
  </button>
</template>
