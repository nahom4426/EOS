import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true },
  },

  // Superadmin routes
  {
    path: '/superadmin',
    component: () => import('../layouts/AdminLayout.vue'),
    meta: { role: 'superadmin' },
    children: [
      { path: '', redirect: '/superadmin/dashboard' },
      { path: 'dashboard', name: 'SuperDashboard', component: () => import('../views/superadmin/OverviewDashboard.vue') },
      { path: 'branches', name: 'Branches', component: () => import('../views/superadmin/BranchesView.vue') },
      { path: 'admins', name: 'BranchAdmins', component: () => import('../views/superadmin/AdminsView.vue') },
      { path: 'users', name: 'AllUsers', component: () => import('../views/superadmin/AllUsersView.vue') },
      { path: 'audit-logs', name: 'SuperAuditLogs', component: () => import('../views/admin/AuditLogsView.vue') },
      { path: 'profile', name: 'SuperProfile', component: () => import('../views/ProfileView.vue') },
    ],
  },

  // Branch admin routes
  {
    path: '/admin',
    component: () => import('../layouts/AdminLayout.vue'),
    meta: { role: 'branch_admin' },
    children: [
      { path: '', redirect: '/admin/dashboard' },
      { path: 'dashboard', name: 'AdminDashboard', component: () => import('../views/admin/AdminDashboard.vue') },
      { path: 'members', name: 'Members', component: () => import('../views/admin/MembersView.vue') },
      { path: 'contributions', name: 'Contributions', component: () => import('../views/admin/ContributionsView.vue') },
      { path: 'reports', name: 'Reports', component: () => import('../views/admin/ReportsView.vue') },
      { path: 'profile', name: 'AdminProfile', component: () => import('../views/ProfileView.vue') },
    ],
  },

  // Member routes
  {
    path: '/member',
    component: () => import('../layouts/MemberLayout.vue'),
    meta: { role: 'member' },
    children: [
      { path: '', redirect: '/member/contributions' },
      { path: 'contributions', name: 'MyContributions', component: () => import('../views/member/MyContributions.vue') },
      { path: 'profile', name: 'MemberProfile', component: () => import('../views/ProfileView.vue') },
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

  if (to.meta.role && auth.user?.role !== to.meta.role) {
    // Redirect to correct home based on role
    if (auth.user?.role === 'superadmin') return next('/superadmin/dashboard')
    if (auth.user?.role === 'branch_admin') return next('/admin/dashboard')
    if (auth.user?.role === 'member') return next('/member/contributions')
    return next('/login')
  }

  next()
})

// After login, redirect to correct home
export function getHomeRoute(role) {
  if (role === 'superadmin') return '/superadmin/dashboard'
  if (role === 'branch_admin') return '/admin/dashboard'
  if (role === 'member') return '/member/contributions'
  return '/login'
}

export default router
