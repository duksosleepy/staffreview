<script setup lang="ts">
import { Avatar, Menu, Button } from '@ark-ui/vue';
import { computed } from 'vue';

type Props = {
  userName: string;
  userEmail?: string;
  role: string;
  avatarUrl?: string;
  notificationCount?: number;
  notificationMessage?: string;
};

const props = defineProps<Props>();

const emit = defineEmits<{
  logout: [];
}>();

const userInitials = computed(() => {
  const parts = props.userName.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`;
  }
  return props.userName.slice(0, 2);
});

const roleDisplay = computed(() => {
  const roleMap: Record<string, string> = {
    asm: 'ASM',
    cht: 'CHT',
    employee: 'Employee',
  };
  return roleMap[props.role.toLowerCase()] || props.role;
});

const handleLogout = () => {
  emit('logout');
};
</script>

<template>
  <Menu.Root>
    <Menu.Trigger
      class="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-300 hover:bg-vermillion-500/10 group shadow-sm border border-transparent hover:border-vermillion-500/20"
    >
      <!-- Avatar with notification badge -->
      <div class="relative">
        <Avatar.Root class="w-11 h-11 shrink-0 ring-2 ring-vermillion-500/20">
          <Avatar.Fallback class="text-sm bg-gradient-to-br from-vermillion-600 to-vermillion-800">
            {{ userInitials }}
          </Avatar.Fallback>
          <Avatar.Image v-if="avatarUrl" :src="avatarUrl" :alt="userName" />
        </Avatar.Root>
        <span
          v-if="notificationCount && notificationCount > 0"
          class="absolute -top-1 -right-1 min-w-[22px] h-[22px] flex items-center justify-center rounded-full bg-gradient-to-r from-vermillion-500 to-vermillion-600 text-white text-xs font-bold px-1 ring-2 ring-ink-deepest shadow-md animate-pulse-glow"
        >
          {{ notificationCount > 99 ? '99+' : notificationCount }}
        </span>
      </div>

      <!-- User Info (hidden on mobile) -->
      <div class="hidden md:flex flex-col items-start min-w-0 flex-1">
        <span class="text-sm font-body font-medium text-paper-white truncate group-hover:text-vermillion-400 transition-colors">
          {{ userName }}
        </span>
        <span class="text-xs text-paper-muted truncate font-body">{{ roleDisplay }}</span>
      </div>

      <!-- Dropdown indicator -->
      <svg
        class="w-5 h-5 text-paper-muted group-hover:text-vermillion-400 transition-colors hidden md:block"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </Menu.Trigger>

    <Menu.Positioner>
      <Menu.Content class="animate-bureau-scale z-[60] min-w-[300px] max-w-xs bg-gradient-to-br from-ink-medium/95 to-ink-deep/95 backdrop-blur-xl border border-vermillion-500/20 shadow-2xl shadow-vermillion-500/10">
        <!-- User Info Header -->
        <div class="px-5 py-5 border-b border-border-subtle bg-gradient-to-r from-vermillion-500/5 to-transparent">
          <div class="flex items-center gap-4">
            <Avatar.Root class="w-16 h-16 shrink-0 ring-2 ring-vermillion-500/20">
              <Avatar.Fallback class="text-lg bg-gradient-to-br from-vermillion-600 to-vermillion-800">
                {{ userInitials }}
              </Avatar.Fallback>
              <Avatar.Image v-if="avatarUrl" :src="avatarUrl" :alt="userName" />
            </Avatar.Root>
            <div class="flex-1 min-w-0">
              <span class="block text-lg font-display font-normal text-paper-white truncate">{{ userName }}</span>
              <span v-if="userEmail" class="block text-sm text-paper-muted truncate mt-1 font-body">
                {{ userEmail }}
              </span>
              <span
                class="mt-2 inline-flex items-center px-3 py-1 text-xs font-body font-medium rounded-full bg-gradient-to-r from-vermillion-500/20 to-vermillion-600/20 text-vermillion-300 border border-vermillion-500/30 w-fit"
              >
                {{ roleDisplay }}
              </span>
            </div>
          </div>
        </div>

        <!-- Notification Section -->
        <div
          v-if="notificationMessage"
          class="px-5 py-4 border-b border-border-subtle bg-vermillion-500/5"
        >
          <div class="flex items-start gap-3">
            <div class="mt-0.5 p-2 rounded-lg bg-vermillion-500/10 text-vermillion-400">
              <svg
                class="w-5 h-5"
                :class="notificationCount && notificationCount > 0 ? 'text-vermillion-400' : 'text-gold-400'"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
            <div class="flex-1">
              <h3 class="text-sm font-body font-semibold text-paper-white mb-1">Thông báo</h3>
              <p class="text-sm text-paper-medium leading-relaxed font-body">{{ notificationMessage }}</p>
            </div>
          </div>
        </div>

        <!-- Menu Items -->
        <Menu.Item value="profile" class="group/item px-4 py-3.5 flex items-center gap-3.5 hover:bg-gradient-vermillion/10 transition-all duration-300 border-l-2 border-transparent hover:border-vermillion-500/50 relative overflow-hidden">
          <div class="p-2.5 rounded-lg bg-gradient-vermillion/15 text-vermillion-400 group-hover/item:text-vermillion-300 transition-all duration-300">
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <span class="text-sm font-body font-medium text-paper-medium group-hover/item:text-paper-white transition-all duration-300 flex-1">Trang cá nhân</span>
          <div class="opacity-0 group-hover/item:opacity-100 transition-opacity duration-300">
            <svg class="w-4 h-4 text-vermillion-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Menu.Item>

        <Menu.Item value="settings" class="group/item px-4 py-3.5 flex items-center gap-3.5 hover:bg-gradient-gold/10 transition-all duration-300 border-l-2 border-transparent hover:border-gold-500/50 relative overflow-hidden">
          <div class="p-2.5 rounded-lg bg-gradient-gold/15 text-gold-400 group-hover/item:text-gold-300 transition-all duration-300">
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <span class="text-sm font-body font-medium text-paper-medium group-hover/item:text-paper-white transition-all duration-300 flex-1">Cài đặt</span>
          <div class="opacity-0 group-hover/item:opacity-100 transition-opacity duration-300">
            <svg class="w-4 h-4 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Menu.Item>

        <Menu.Separator class="my-1 bg-gradient-vermillion/20 h-px" />

        <Menu.Item value="logout" class="group/item px-4 py-3.5 flex items-center gap-3.5 text-vermillion-400 hover:bg-vermillion-500/15 transition-all duration-300 border-l-2 border-transparent hover:border-vermillion-500/50 relative overflow-hidden" @click="handleLogout">
          <div class="p-2.5 rounded-lg bg-gradient-vermillion/15 text-vermillion-400 group-hover/item:text-vermillion-300 transition-all duration-300">
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </div>
          <span class="text-sm font-body font-medium text-vermillion-400 group-hover/item:text-vermillion-300 transition-all duration-300 flex-1">Đăng xuất</span>
          <div class="opacity-0 group-hover/item:opacity-100 transition-opacity duration-300">
            <svg class="w-4 h-4 text-vermillion-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Menu.Item>
      </Menu.Content>
    </Menu.Positioner>
  </Menu.Root>
</template>
