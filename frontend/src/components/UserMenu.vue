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
    asm: "Area Manager",
    cht: "Team Lead",
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
      class="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all duration-200 hover:bg-white/5 group"
    >
      <!-- Avatar with notification badge -->
      <div class="relative">
        <Avatar.Root class="w-10 h-10 shrink-0">
          <Avatar.Fallback>{{ userInitials }}</Avatar.Fallback>
          <Avatar.Image v-if="avatarUrl" :src="avatarUrl" :alt="userName" />
        </Avatar.Root>
        <span
          v-if="notificationCount && notificationCount > 0"
          class="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 ring-2 ring-[#26232B]"
        >
          {{ notificationCount > 99 ? '99+' : notificationCount }}
        </span>
      </div>

      <!-- User Info (hidden on mobile) -->
      <div class="hidden sm:flex flex-col items-start">
        <span class="text-sm font-medium text-white group-hover:text-teal-300 transition-colors">
          {{ userName }}
        </span>
        <span class="text-xs text-gray-400">{{ roleDisplay }}</span>
      </div>

      <!-- Dropdown indicator -->
      <svg
        class="w-4 h-4 text-gray-400 group-hover:text-teal-400 transition-colors hidden sm:block"
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
      <Menu.Content class="animate-menu-in z-50">
        <!-- User Info Header -->
        <div class="px-3 py-3 border-b border-white/10 mb-1">
          <div class="flex items-center gap-3">
            <Avatar.Root class="w-12 h-12 shrink-0">
              <Avatar.Fallback>{{ userInitials }}</Avatar.Fallback>
              <Avatar.Image v-if="avatarUrl" :src="avatarUrl" :alt="userName" />
            </Avatar.Root>
            <div class="flex flex-col">
              <span class="text-sm font-semibold text-white">{{ userName }}</span>
              <span v-if="userEmail" class="text-xs text-gray-400 truncate max-w-[140px]">
                {{ userEmail }}
              </span>
              <span
                class="mt-1 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 w-fit"
              >
                {{ roleDisplay }}
              </span>
            </div>
          </div>
        </div>

        <!-- Notification Section -->
        <div
          v-if="notificationMessage"
          class="px-3 py-2.5 border-b border-white/10 mb-1"
        >
          <div class="flex items-start gap-2.5">
            <svg
              class="w-4 h-4 mt-0.5 shrink-0"
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
            <span class="text-xs text-gray-300 leading-relaxed">{{ notificationMessage }}</span>
          </div>
        </div>

        <!-- Menu Items -->
        <Menu.Item value="profile" class="group/item">
          <svg
            class="w-4 h-4 text-gray-400 group-hover/item:text-teal-400 transition-colors"
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
          <span>Trang ca nhan</span>
        </Menu.Item>

        <Menu.Item value="settings" class="group/item">
          <svg
            class="w-4 h-4 text-gray-400 group-hover/item:text-teal-400 transition-colors"
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
          <span>Cai dat</span>
        </Menu.Item>

        <Menu.Separator />

        <Menu.Item value="logout" class="group/item !text-red-400" @click="handleLogout">
          <svg
            class="w-4 h-4 text-red-400 group-hover/item:text-red-300 transition-colors"
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
          <span>Dang xuat</span>
        </Menu.Item>
      </Menu.Content>
    </Menu.Positioner>
  </Menu.Root>
</template>
