<script setup lang="ts">
import { Button, Card } from '@ark-ui/vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();

const handleLogin = () => {
  auth.login();
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0C0A0F] via-[#131118] to-[#1A1720] relative overflow-hidden">
    <!-- Animated background elements -->
    <div class="absolute inset-0 overflow-hidden">
      <!-- Geometric patterns -->
      <div class="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-vermillion-500/5 blur-3xl animate-pulse"></div>
      <div class="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-gold-500/5 blur-3xl animate-pulse delay-1000"></div>

      <!-- Floating particles -->
      <div v-for="i in 20" :key="i" class="absolute rounded-full bg-paper-light/5"
           :style="{
             top: `${Math.random() * 100}%`,
             left: `${Math.random() * 100}%`,
             width: `${Math.random() * 4 + 1}px`,
             height: `${Math.random() * 4 + 1}px`,
             animation: `float ${Math.random() * 10 + 10}s infinite ease-in-out`,
             animationDelay: `${Math.random() * 5}s`
           }"></div>
    </div>

    <!-- Noise texture overlay -->
    <div class="noise-overlay absolute inset-0 pointer-events-none"></div>

    <!-- Login card -->
    <Card.Root class="w-full max-w-md relative z-10 glass-card border border-border-medium shadow-xl animate-bureau-enter">
      <Card.Header class="text-center pb-6 pt-8 px-8">
        <div class="flex justify-center mb-4">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-vermillion-500 to-vermillion-700 flex items-center justify-center shadow-lg shadow-vermillion-500/30">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>
        <Card.Title class="text-2xl font-display font-normal text-paper-white mb-2">Staff Review</Card.Title>
        <Card.Description class="text-paper-muted font-body text-sm">
          Vui lòng đăng nhập để tiếp tục
        </Card.Description>
      </Card.Header>

      <Card.Body class="px-8 pb-8">
        <!-- Login Button -->
        <Button
          variant="solid"
          class="w-full py-4 bg-gradient-to-r from-vermillion-500 to-vermillion-600 hover:from-vermillion-400 hover:to-vermillion-500 text-white font-body font-medium text-sm tracking-wide uppercase transition-all duration-300 flex items-center justify-center gap-3 shadow-vermillion group"
          @click="handleLogin"
        >
          <svg
            class="w-5 h-5 transition-transform duration-300 group-hover:rotate-12"
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
          Đăng nhập với SSO
        </Button>

        <!-- Footer -->
        <p class="mt-6 text-center text-xs text-paper-muted font-body">
          Bạn sẽ được chuyển đến trang đăng nhập công ty
        </p>
      </Card.Body>
    </Card.Root>

    <!-- Decorative elements -->
    <div class="absolute top-10 left-10 w-24 h-0.5 bg-gradient-to-r from-transparent via-vermillion-500 to-transparent opacity-30"></div>
    <div class="absolute bottom-10 right-10 w-24 h-0.5 bg-gradient-to-l from-transparent via-gold-500 to-transparent opacity-30"></div>
  </div>

  <!-- Custom animations -->
  <style scoped>
    @keyframes float {
      0%, 100% { transform: translate(0, 0) rotate(0deg); }
      50% { transform: translate(20px, -20px) rotate(180deg); }
    }
  </style>
</template>
