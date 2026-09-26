import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true },
  },

  // ── Superadmin routes ──────────────────────────────────────────────────────
  {
    path: '/superadmin',
    component: () => import('../layouts/AdminLayout.vue'),
    meta: { roles: ['superadmin'] },
    children: [
      { path: '', redirect: '/superadmin/dashboard' },
      { path: 'dashboard',  name: 'SuperDashboard',  component: () => import('../views/superadmin/OverviewDashboard.vue') },
      { path: 'branches',   name: 'Branches',         component: () => import('../views/superadmin/BranchesView.vue') },
      { path: 'admins',     name: 'BranchAdmins',     component: () => import('../views/superadmin/AdminsView.vue') },
      { path: 'users',      name: 'AllUsers',          component: () => import('../views/superadmin/AllUsersView.vue') },
      { path: 'audit-logs', name: 'SuperAuditLogs',   component: () => import('../views/admin/AuditLogsView.vue') },
      { path: 'settings',   name: 'SuperSettings',    component: () => import('../views/admin/AdminSettingsView.vue') },
      { path: 'profile',    name: 'SuperProfile',     component: () => import('../views/ProfileView.vue') },
    ],
  },

  // ── Admin routes ───────────────────────────────────────────────────────────
  {
    path: '/admin',
    component: () => import('../layouts/AdminLayout.vue'),
    meta: { roles: ['admin'] },
    children: [
      { path: '', redirect: '/admin/dashboard' },
      { path: 'dashboard',     name: 'AdminDashboard',   component: () => import('../views/admin/AdminDashboard.vue') },
      { path: 'members',       name: 'Members',           component: () => import('../views/admin/MembersView.vue') },
      { path: 'contributions', name: 'Contributions',     component: () => import('../views/admin/ContributionsView.vue') },
      { path: 'handovers',     name: 'AdminHandovers',    component: () => import('../views/admin/AdminHandoverView.vue') },
      { path: 'reports',       name: 'Reports',           component: () => import('../views/admin/ReportsView.vue') },
      { path: 'settings',      name: 'AdminSettings',     component: () => import('../views/admin/AdminSettingsView.vue') },
      { path: 'profile',       name: 'AdminProfile',      component: () => import('../views/ProfileView.vue') },
    ],
  },

  // ── Mini-Admin routes ──────────────────────────────────────────────────────
  {
    path: '/mini-admin',
    component: () => import('../layouts/MiniAdminLayout.vue'),
    meta: { roles: ['mini_admin'] },
    children: [
      { path: '', redirect: '/mini-admin/dashboard' },
      { path: 'dashboard', name: 'MiniAdminDashboard', component: () => import('../views/mini-admin/MiniAdminDashboard.vue') },
      { path: 'members',   name: 'MiniAdminMembers',   component: () => import('../views/admin/MembersView.vue') },
      { path: 'profile',   name: 'MiniAdminProfile',   component: () => import('../views/ProfileView.vue') },
    ],
  },

  // ── First Child routes ─────────────────────────────────────────────────────
  {
    path: '/first-child',
    component: () => import('../layouts/FirstChildLayout.vue'),
    meta: { roles: ['first_child'] },
    children: [
      { path: '', redirect: '/first-child/contributions' },
      { path: 'contributions', name: 'FirstChildContributions', component: () => import('../views/first-child/FirstChildContributionForm.vue') },
      { path: 'siblings',     name: 'FirstChildSiblings',      component: () => import('../views/first-child/FirstChildSiblingsView.vue') },
      { path: 'history',      name: 'FirstChildHistory',       component: () => import('../views/first-child/FirstChildHistoryView.vue') },
      { path: 'profile',      name: 'FirstChildProfile',       component: () => import('../views/ProfileView.vue') },
    ],
  },

  // ── Member routes ──────────────────────────────────────────────────────────
  {
    path: '/member',
    component: () => import('../layouts/MemberLayout.vue'),
    meta: { roles: ['member'] },
    children: [
      { path: '', redirect: '/member/contributions' },
      { path: 'contributions', name: 'MyContributions', component: () => import('../views/member/MyContributions.vue') },
      { path: 'profile',       name: 'MemberProfile',   component: () => import('../views/ProfileView.vue') },
    ],
  },

  // Root redirect
  { path: '/', redirect: '/login' },
  { path: '/:pathMatch(.*)*', redirect: '/login' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()

  if (to.meta.public) return next()

  if (!auth.isAuthenticated) return next('/login')

  // Support both old single `role` and new `roles` array in meta
  const allowedRoles = to.meta.roles || (to.meta.role ? [to.meta.role] : null)
  if (allowedRoles && !allowedRoles.includes(auth.user?.role)) {
    return next(getHomeRoute(auth.user?.role))
  }

  next()
})

/** Get the home route for a given role */
export function getHomeRoute(role) {
  if (role === 'superadmin')  return '/superadmin/dashboard'
  if (role === 'admin')       return '/admin/dashboard'
  if (role === 'mini_admin')  return '/mini-admin/dashboard'
  if (role === 'first_child') return '/first-child/contributions'
  if (role === 'member')      return '/member/contributions'
  return '/login'
}

export default router
