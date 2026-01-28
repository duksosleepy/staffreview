import type { RouteLocationNormalized } from 'vue-router';
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

// Lazy load pages
const SheetPage = () => import('@/pages/SheetPage.vue');
const LoginPage = () => import('@/pages/LoginPage.vue');

const routes = [
  {
    path: '/',
    name: 'Home',
    component: SheetPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginPage,
    meta: { requiresAuth: false, isAuthPage: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Auth guard
router.beforeEach(async (to: RouteLocationNormalized) => {
  const auth = useAuthStore();

  // Fetch user if not loaded yet
  if (auth.isLoading || (!auth.isAuthenticated && !auth.user)) {
    await auth.fetchUser();
  }

  const requiresAuth = to.meta.requiresAuth !== false;
  const isAuthPage = to.meta.isAuthPage === true;

  // Redirect directly to Casdoor SSO if not authenticated and route requires auth
  if (requiresAuth && !auth.isAuthenticated) {
    // Redirect to backend auth endpoint which will redirect to Casdoor
    window.location.href = '/auth/login';
    return false;
  }

  // Redirect to home if already authenticated and trying to access auth pages
  if (isAuthPage && auth.isAuthenticated) {
    return { name: 'Home' };
  }

  return true;
});

export default router;
