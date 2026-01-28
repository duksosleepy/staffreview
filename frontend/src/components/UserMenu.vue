<script setup lang="ts">
import { computed } from "vue";
import { Avatar, Menu } from "@ark-ui/vue";

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
  const parts = props.userName.split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`;
  }
  return props.userName.slice(0, 2);
});

const roleDisplay = computed(() => {
  const roleMap: Record<string, string> = {
    asm: "ASM",
    cht: "CHT",
    employee: "Employee",
  };
  return roleMap[props.role.toLowerCase()] || props.role;
});

const handleLogout = () => {
  emit("logout");
};
</script>

<template>
  <Menu.Root>
    <Menu.Trigger
      class="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 hover:bg-white/10 group shadow-sm"
    >
      <!-- Avatar with notification badge -->
      <div class="relative">
        <Avatar.Root class="w-11 h-11 shrink-0">
          <Avatar.Fallback class="text-sm">{{ userInitials }}</Avatar.Fallback>
          <Avatar.Image v-if="avatarUrl" :src="avatarUrl" :alt="userName" />
        </Avatar.Root>
        <span
          v-if="notificationCount && notificationCount > 0"
          class="absolute -top-1 -right-1 min-w-[22px] h-[22px] flex items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold px-1 ring-2 ring-[#26232B] shadow-md"
        >
          {{ notificationCount > 99 ? '99+' : notificationCount }}
        </span>
      </div>

      <!-- User Info (hidden on mobile) -->
      <div class="hidden md:flex flex-col items-start min-w-0 flex-1">
        <span class="text-sm font-semibold text-white truncate group-hover:text-teal-300 transition-colors">
          {{ userName }}
        </span>
        <span class="text-xs text-gray-400 truncate">{{ roleDisplay }}</span>
      </div>

      <!-- Dropdown indicator -->
      <svg
        class="w-5 h-5 text-gray-400 group-hover:text-teal-400 transition-colors hidden md:block"
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
      <Menu.Content class="animate-menu-in z-50 min-w-[280px] max-w-xs">
        <!-- User Info Header -->
        <div class="px-5 py-4 border-b border-white/10 bg-gradient-to-r from-[#26232b]/50 to-[#1e1b24]">
          <div class="flex items-center gap-4">
            <Avatar.Root class="w-14 h-14 shrink-0">
              <Avatar.Fallback class="text-base">{{ userInitials }}</Avatar.Fallback>
              <Avatar.Image v-if="avatarUrl" :src="avatarUrl" :alt="userName" />
            </Avatar.Root>
            <div class="flex-1 min-w-0">
              <span class="block text-base font-bold text-white truncate">{{ userName }}</span>
              <span v-if="userEmail" class="block text-sm text-gray-400 truncate mt-0.5">
                {{ userEmail }}
              </span>
              <span
                class="mt-2 inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-gradient-to-r from-teal-500/20 to-teal-600/20 text-teal-300 border border-teal-500/30 w-fit"
              >
                {{ roleDisplay }}
              </span>
            </div>
          </div>
        </div>

        <!-- Notification Section -->
        <div
          v-if="notificationMessage"
          class="px-5 py-4 border-b border-white/10 bg-amber-500/5"
        >
          <div class="flex items-start gap-3">
            <div class="mt-0.5 p-1.5 rounded-lg bg-amber-500/10">
              <svg
                class="w-5 h-5"
                :class="notificationCount && notificationCount > 0 ? 'text-amber-400' : 'text-green-400'"
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
              <h3 class="text-sm font-semibold text-white mb-1">Thông báo</h3>
              <p class="text-sm text-gray-300 leading-relaxed">{{ notificationMessage }}</p>
            </div>
          </div>
        </div>

        <!-- Menu Items -->
        <Menu.Item value="profile" class="group/item px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors">
          <div class="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover/item:text-blue-300 transition-colors">
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
          <span class="text-sm font-medium text-gray-300 group-hover/item:text-white transition-colors">Trang cá nhân</span>
        </Menu.Item>

        <Menu.Item value="settings" class="group/item px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors">
          <div class="p-2 rounded-lg bg-purple-500/10 text-purple-400 group-hover/item:text-purple-300 transition-colors">
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
          <span class="text-sm font-medium text-gray-300 group-hover/item:text-white transition-colors">Cài đặt</span>
        </Menu.Item>

        <Menu.Separator class="my-1 bg-white/10" />

        <Menu.Item value="logout" class="group/item px-4 py-3 flex items-center gap-3 text-red-400 hover:bg-red-500/10 transition-colors" @click="handleLogout">
          <div class="p-2 rounded-lg bg-red-500/10 text-red-400 group-hover/item:text-red-300 transition-colors">
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
          <span class="text-sm font-medium text-red-400 group-hover/item:text-red-300 transition-colors">Đăng xuất</span>
        </Menu.Item>
      </Menu.Content>
    </Menu.Positioner>
  </Menu.Root>
</template>
