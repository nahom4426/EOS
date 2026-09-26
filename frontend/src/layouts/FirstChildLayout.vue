<template>
  <div class="fc-layout">
    <header class="fc-topbar">
      <div class="fc-topbar-left">
        <img src="/assets/images/logo.jpg" alt="ጥቁር አንበሳ ግቢ ጉባኤ Logo" class="fc-logo" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1.5px solid var(--gold);" />
        <div>
          <div class="fc-title">ጥቁር አንበሳ ግቢ ጉባኤ</div>
          <div class="fc-subtitle">Family Representative Portal</div>
        </div>
      </div>
      <div class="fc-topbar-right">
        <span class="fc-user-badge">{{ auth.user?.full_name?.split(' ')[0] }}</span>
        <button class="btn btn-ghost btn-sm" @click="handleLogout">🚪 Logout</button>
      </div>
    </header>

    <nav class="fc-nav">
      <RouterLink to="/first-child/contributions" class="fc-nav-link" active-class="active">
        💰 Record Contributions
      </RouterLink>
      <RouterLink to="/first-child/siblings" class="fc-nav-link" active-class="active">
        👨‍👩‍👧‍👦 My Siblings
      </RouterLink>
      <RouterLink to="/first-child/history" class="fc-nav-link" active-class="active">
        📋 History
      </RouterLink>
      <RouterLink to="/first-child/profile" class="fc-nav-link" active-class="active">
        ⚙️ My Profile
      </RouterLink>
    </nav>

    <main class="fc-main">
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
.fc-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.fc-topbar {
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-color);
  padding: 0.85rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.fc-topbar-left {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.fc-logo {
  width: 32px;
  height: 32px;
  filter: drop-shadow(0 0 4px rgba(212,175,55,0.4));
}

.fc-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--gold);
}

.fc-subtitle {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.fc-topbar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.fc-user-badge {
  background: rgba(212,175,55,0.15);
  color: var(--gold);
  border: 1px solid rgba(212,175,55,0.3);
  border-radius: 20px;
  padding: 0.25rem 0.75rem;
  font-size: 0.82rem;
  font-weight: 600;
}

.fc-nav {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  gap: 0;
  padding: 0 1.5rem;
}

.fc-nav-link {
  padding: 0.75rem 1.25rem;
  text-decoration: none;
  color: var(--text-muted);
  font-size: 0.875rem;
  font-weight: 500;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.fc-nav-link:hover,
.fc-nav-link.active {
  color: var(--gold);
  border-bottom-color: var(--gold);
}

.fc-main {
  flex: 1;
  padding: 1.5rem;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

@media (max-width: 600px) {
  .fc-topbar { padding: 0.75rem 1rem; }
  .fc-main { padding: 1rem; }
}
</style>
