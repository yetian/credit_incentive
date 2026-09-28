import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from './api';
import { store } from './store';

const routes = [
  { path: '/login', name: 'login', component: () => import('./views/LoginView.vue') },

  // ---- Child experience ----
  { path: '/', name: 'dashboard', meta: { mode: 'child' }, component: () => import('./views/child/DashboardView.vue') },
  { path: '/tasks', name: 'tasks', meta: { mode: 'child' }, component: () => import('./views/child/TasksView.vue') },
  { path: '/proposals', name: 'proposals', meta: { mode: 'child' }, component: () => import('./views/child/ProposalsView.vue') },
  { path: '/shop', name: 'shop', meta: { mode: 'child' }, component: () => import('./views/child/ShopView.vue') },
  { path: '/finance', name: 'finance', meta: { mode: 'child' }, component: () => import('./views/child/FinanceView.vue') },

  // ---- Parent admin backend (fully separate) ----
  { path: '/admin', name: 'admin', meta: { mode: 'admin' }, component: () => import('./views/admin/ChildrenView.vue') },
  { path: '/admin/tasks', name: 'admin-tasks', meta: { mode: 'admin' }, component: () => import('./views/admin/TasksAdminView.vue') },
  { path: '/admin/rewards', name: 'admin-rewards', meta: { mode: 'admin' }, component: () => import('./views/admin/RewardsAdminView.vue') },
  { path: '/admin/proposals', name: 'admin-proposals', meta: { mode: 'admin' }, component: () => import('./views/admin/ProposalsAdminView.vue') },
  { path: '/admin/members', name: 'admin-members', meta: { mode: 'admin' }, component: () => import('./views/admin/MembersAdminView.vue') },
  { path: '/admin/settings', name: 'admin-settings', meta: { mode: 'admin' }, component: () => import('./views/admin/SettingsView.vue') },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const authed = Boolean(getToken());

  if (to.name !== 'login' && !authed) return { name: 'login' };

  if (to.name === 'login' && authed) {
    return { name: store.profile?.tenant.role === 'PARENT' ? 'admin' : 'dashboard' };
  }

  const mode = to.matched.find((r) => r.meta.mode)?.meta.mode as 'child' | 'admin' | undefined;
  if (authed && mode && store.profile) {
    const isParent = store.profile.tenant.role === 'PARENT';
    if (isParent && mode === 'child') return { name: 'admin' };
    if (!isParent && mode === 'admin') return { name: 'dashboard' };
  }

  return true;
});
