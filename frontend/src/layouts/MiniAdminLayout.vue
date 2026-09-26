<template>
  <div class="ma-layout">
    <header class="ma-topbar">
      <div class="ma-topbar-left">
        <img src="/assets/images/logo.jpg" alt="ጥቁር አንበሳ ግቢ ጉባኤ Logo" class="ma-logo" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1.5px solid var(--gold);" />
        <div>
          <div class="ma-title">ጥቁር አንበሳ ግቢ ጉባኤ</div>
          <div class="ma-subtitle">Mini-Admin · Cash Handover</div>
        </div>
      </div>
      <div class="ma-topbar-right">
        <span class="ma-user-badge">{{ auth.user?.full_name?.split(' ')[0] }}</span>
        <button class="btn btn-ghost btn-sm" @click="handleLogout">🚪 Logout</button>
      </div>
    </header>

    <nav class="ma-nav">
      <RouterLink to="/mini-admin/dashboard" class="ma-nav-link" active-class="active">
        📊 Dashboard
      </RouterLink>
      <RouterLink to="/mini-admin/members" class="ma-nav-link" active-class="active">
        👥 Members &amp; Families
      </RouterLink>
      <RouterLink to="/mini-admin/profile" class="ma-nav-link" active-class="active">
        ⚙️ My Profile
      </RouterLink>
    </nav>

    <main class="ma-main">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>

<script setup>
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useAudioStore } from '../stores/audio'

const auth = useAuthStore()
const audio = useAudioStore()
const router = useRouter()

function handleLogout() {
  audio.stopPlayback?.()
  auth.logout()
  router.push('/login')
}
</script>

<style scoped>
.ma-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.ma-topbar {
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-color);
  padding: 0.85rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ma-topbar-left {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.ma-logo { width: 32px; height: 32px; filter: drop-shadow(0 0 4px rgba(212,175,55,0.4)); }

.ma-title { font-size: 0.85rem; font-weight: 700; color: var(--gold); }
.ma-subtitle { font-size: 0.72rem; color: var(--text-muted); }

.ma-topbar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.ma-user-badge {
  background: rgba(212,175,55,0.15);
  color: var(--gold);
  border: 1px solid rgba(212,175,55,0.3);
  border-radius: 20px;
  padding: 0.25rem 0.75rem;
  font-size: 0.82rem;
  font-weight: 600;
}

.ma-nav {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  padding: 0 1.5rem;
}

.ma-nav-link {
  padding: 0.75rem 1.25rem;
  text-decoration: none;
  color: var(--text-muted);
  font-size: 0.875rem;
  font-weight: 500;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.ma-nav-link:hover, .ma-nav-link.active {
  color: var(--gold);
  border-bottom-color: var(--gold);
}

.ma-main {
  flex: 1;
  padding: 1.5rem;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
}
</style>
