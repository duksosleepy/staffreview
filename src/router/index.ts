import { createRouter, createWebHistory } from 'vue-router';
import SheetPage from '../pages/SheetPage.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: SheetPage,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
