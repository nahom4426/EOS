<template>
  <div class="layout-wrapper">
    <!-- Mobile Sidebar Backdrop Overlay -->
    <div
      class="sidebar-backdrop"
      :class="{ active: sidebarOpen }"
      @click="sidebarOpen = false"
    ></div>

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-logo">
        <div class="logo-icon" style="background:none;padding:0;">
          <img src="/assets/images/orthodox_logo.svg" alt="Orthodox Cross" style="width:32px;height:32px;filter:drop-shadow(0 0 4px rgba(212,175,55,0.4));" />
        </div>
        <div>
          <div class="logo-text">የኢትዮጵያ ኦርቶዶክስ ተዋሕዶ</div>
          <div class="logo-sub">{{ auth.user?.role === 'superadmin' ? (lang === 'en' ? 'Superadmin System' : 'ሱፐር አስተዳዳሪ') : (lang === 'en' ? 'Branch Admin' : 'የቅርንጫፍ አስተዳዳሪ') }}</div>
        </div>
      </div>

      <nav class="sidebar-nav">
        <!-- Superadmin nav -->
        <template v-if="auth.isSuperAdmin">
          <div class="nav-section-label">{{ lang === 'en' ? 'Management' : 'አስተዳደር' }}</div>
          <RouterLink to="/superadmin/dashboard" class="nav-link" @click="sidebarOpen = false">
            <span class="nav-icon">📊</span> {{ t('nav.overview') }}
          </RouterLink>
          <RouterLink to="/superadmin/branches" class="nav-link" @click="sidebarOpen = false">
            <span class="nav-icon">🏛️</span> {{ t('nav.branches') }}
          </RouterLink>
          <RouterLink to="/superadmin/admins" class="nav-link" @click="sidebarOpen = false">
            <span class="nav-icon">👤</span> {{ t('nav.admins') }}
          </RouterLink>
          <RouterLink to="/superadmin/users" class="nav-link" @click="sidebarOpen = false">
            <span class="nav-icon">👥</span> {{ lang === 'en' ? 'All Users' : 'ሁሉም ተጠቃሚዎች' }}
          </RouterLink>
          <RouterLink to="/superadmin/audit-logs" class="nav-link" @click="sidebarOpen = false">
            <span class="nav-icon">🔍</span> {{ lang === 'en' ? 'Audit Logs' : 'የስርዓት መዝገብ' }}
          </RouterLink>
          <RouterLink to="/superadmin/profile" class="nav-link" @click="sidebarOpen = false">
            <span class="nav-icon">⚙️</span> {{ lang === 'en' ? 'My Profile' : 'የግል መረጃ' }}
          </RouterLink>
        </template>

        <!-- Branch admin nav -->
        <template v-if="auth.isBranchAdmin">
          <div class="nav-section-label">{{ lang === 'en' ? 'Branch' : 'ቅርንጫፍ' }}</div>
          <RouterLink to="/admin/dashboard" class="nav-link" @click="sidebarOpen = false">
            <span class="nav-icon">📊</span> {{ t('nav.dashboard') }}
          </RouterLink>
          <RouterLink to="/admin/members" class="nav-link" @click="sidebarOpen = false">
            <span class="nav-icon">👥</span> {{ t('nav.members') }}
          </RouterLink>
          <RouterLink to="/admin/contributions" class="nav-link" @click="sidebarOpen = false">
            <span class="nav-icon">💰</span> {{ t('nav.contributions') }}
          </RouterLink>
          <RouterLink to="/admin/reports" class="nav-link" @click="sidebarOpen = false">
            <span class="nav-icon">📋</span> {{ t('nav.reports') }}
          </RouterLink>
          <RouterLink to="/admin/profile" class="nav-link" @click="sidebarOpen = false">
            <span class="nav-icon">⚙️</span> {{ lang === 'en' ? 'My Profile' : 'የግል መረጃ' }}
          </RouterLink>
        </template>
      </nav>

      <div class="sidebar-footer">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">
          <img v-if="getAvatarUrl(auth.user?.avatar_url)" :src="getAvatarUrl(auth.user?.avatar_url)" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:1px solid var(--gold);" />
          <div v-else style="width:32px;height:32px;border-radius:50%;background:rgba(212,175,55,0.2);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--gold);font-size:0.8rem;">
            {{ auth.user?.full_name?.charAt(0) || '👤' }}
          </div>
          <div style="font-size:0.82rem;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            {{ auth.user?.full_name }}
          </div>
        </div>
        <button class="btn btn-ghost w-full btn-sm" @click="handleLogout">
          🚪 {{ t('nav.logout') }}
        </button>
      </div>
    </aside>

    <!-- Main area -->
    <div class="main-content">
      <!-- Top bar -->
      <header class="topbar">
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <button class="mobile-menu-btn" @click="sidebarOpen = !sidebarOpen" aria-label="Toggle menu">☰</button>
          <span class="topbar-date" style="font-size:0.85rem;color:var(--text-muted);">
            {{ currentDate }}
          </span>
        </div>
        <div class="topbar-actions">
          <!-- Classical Orthodox Music equalizer toggle button -->
          <button
            class="topbar-music-btn"
            :class="{ playing: audio.isMusicPlaying }"
            @click="audio.toggleMusic()"
            :title="audio.isMusicPlaying ? 'Mute Classical Orthodox Music' : 'Play Classical Orthodox Music'"
          >
            <div v-if="audio.isMusicPlaying" class="audio-equalizer">
              <span class="eq-bar bar-1"></span>
              <span class="eq-bar bar-2"></span>
              <span class="eq-bar bar-3"></span>
            </div>
            <span v-else class="music-icon">🔇</span>
          </button>

          <!-- Language toggle -->
          <div class="lang-toggle">
            <button class="lang-btn" :class="{ active: lang === 'en' }" @click="setLang('en')">EN</button>
            <button class="lang-btn" :class="{ active: lang === 'am' }" @click="setLang('am')">አማ</button>
          </div>
          <!-- Theme toggle -->
          <button class="theme-toggle" @click="theme.toggle()" :title="theme.isDark ? 'Switch to light' : 'Switch to dark'">
            {{ theme.isDark ? '☀️' : '🌙' }}
          </button>
          <!-- User Profile Link -->
          <RouterLink :to="auth.isSuperAdmin ? '/superadmin/profile' : '/admin/profile'" style="text-decoration:none;display:flex;align-items:center;gap:0.5rem;">
            <img v-if="getAvatarUrl(auth.user?.avatar_url)" :src="getAvatarUrl(auth.user?.avatar_url)" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1px solid var(--gold);" />
            <div class="badge badge-gold">{{ auth.user?.full_name?.split(' ')[0] }}</div>
          </RouterLink>
        </div>
      </header>

      <!-- Page content -->
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { useLangStore } from '../stores/lang'
import { useThemeStore } from '../stores/theme'
import { useAudioStore } from '../stores/audio'
import { getAvatarUrl } from '../utils/avatar'

const { t } = useI18n()
const auth = useAuthStore()
const langStore = useLangStore()
const theme = useThemeStore()
const audio = useAudioStore()
const router = useRouter()
const sidebarOpen = ref(false)

const lang = computed(() => langStore.lang)

function setLang(l) { langStore.setLang(l) }

function handleLogout() {
  audio.stopPlayback()
  auth.logout()
  router.push('/login')
}

watch(() => router.currentRoute.value.path, () => {
  sidebarOpen.value = false
})

const currentDate = computed(() => {
  return new Date().toLocaleDateString(lang.value === 'am' ? 'am-ET' : 'en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
})

onMounted(() => {
  audio.initForPage(false)
})
</script>

<style scoped>
.topbar-music-btn {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 9999px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s ease;
}

.topbar-music-btn:hover {
  border-color: var(--gold);
  transform: scale(1.05);
}

.topbar-music-btn.playing {
  border-color: var(--gold);
  background: rgba(212, 175, 55, 0.15);
  box-shadow: 0 0 12px rgba(212, 175, 55, 0.3);
}

.audio-equalizer {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 16px;
}

.eq-bar {
  width: 3px;
  background: var(--gold);
  border-radius: 3px;
  animation: eqPulse 0.8s ease-in-out infinite alternate;
}

.eq-bar.bar-1 { height: 60%; animation-delay: 0s; }
.eq-bar.bar-2 { height: 100%; animation-delay: 0.2s; }
.eq-bar.bar-3 { height: 40%; animation-delay: 0.4s; }

@keyframes eqPulse {
  0% { transform: scaleY(0.3); }
  100% { transform: scaleY(1); }
}
</style>
