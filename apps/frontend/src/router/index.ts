import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores';

const LoginView = () => import('@/views/LoginView.vue');
const DashboardView = () => import('@/views/DashboardView.vue');
const BossSelectView = () => import('@/views/BossSelectView.vue');
const LeaderboardView = () => import('@/views/LeaderboardView.vue');
const HistoryView = () => import('@/views/HistoryView.vue');

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/login' },
  { path: '/login', name: 'Login', component: LoginView, meta: { requiresGuest: true } },
  { path: '/dashboard', name: 'Dashboard', component: DashboardView, meta: { requiresAuth: true } },
  { path: '/boss-select', name: 'BossSelect', component: BossSelectView, meta: { requiresAuth: true } },
  { path: '/leaderboard', name: 'Leaderboard', component: LeaderboardView, meta: { requiresAuth: true } },
  { path: '/history', name: 'History', component: HistoryView, meta: { requiresAuth: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  }
});

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();
  if (!authStore.isInitialized) await authStore.restoreAuthState();
  const isLoggedIn = authStore.isLoggedIn;
  if (to.meta.requiresAuth && !isLoggedIn) return next('/login');
  if (to.meta.requiresGuest && isLoggedIn) return next('/dashboard');
  document.title = 'Coin Quest ⚔️';
  next();
});

export default router;
