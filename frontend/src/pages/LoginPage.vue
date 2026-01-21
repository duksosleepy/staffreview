<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();

const handleLogin = () => {
  auth.login();
};
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-screen bg-[#26232B]">
    <div class="w-full max-w-md p-8 bg-[#292630] border border-[#3d3a45] rounded-xl shadow-2xl">
      <!-- Logo/Title -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Staff Review</h1>
        <p class="text-gray-400">Vui long dang nhap de tiep tuc</p>
      </div>

      <!-- Login Button -->
      <button
        type="button"
        class="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
        @click="handleLogin"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
          />
        </svg>
        Dang nhap voi SSO
      </button>

      <!-- Footer -->
      <p class="mt-6 text-center text-sm text-gray-500">
        Ban se duoc chuyen den trang dang nhap cong ty
      </p>
    </div>
  </div>
</template>
