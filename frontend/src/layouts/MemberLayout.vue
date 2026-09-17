<template>
  <div class="member-layout">
    <!-- Header -->
    <header class="member-header">
      <div class="member-logo">
        <div class="logo-icon" style="background:none;padding:0;">
          <img src="/assets/images/orthodox_logo.svg" alt="Orthodox Cross" style="width:32px;height:32px;filter:drop-shadow(0 0 4px rgba(212,175,55,0.4));" />
        </div>
        <div>
          <div class="logo-text">የኢትዮጵያ ኦርቶዶክስ ተዋሕዶ</div>
          <div class="logo-sub">{{ t('myContributions.title') }}</div>
        </div>
      </div>
      <div class="topbar-actions">
        <RouterLink to="/member/contributions" class="btn btn-ghost btn-sm">
          💰 {{ t('nav.myContributions') }}
        </RouterLink>
        <RouterLink to="/member/profile" class="btn btn-ghost btn-sm" style="display:flex;align-items:center;gap:0.4rem;">
          <img v-if="getAvatarUrl(auth.user?.avatar_url)" :src="getAvatarUrl(auth.user?.avatar_url)" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:1px solid var(--gold);" />
          <span v-else>👤</span>
          {{ lang === 'en' ? 'Profile' : 'መገለጫ' }}
        </RouterLink>
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
        <div class="lang-toggle">
          <button class="lang-btn" :class="{ active: lang === 'en' }" @click="setLang('en')">EN</button>
          <button class="lang-btn" :class="{ active: lang === 'am' }" @click="setLang('am')">አማ</button>
        </div>
        <button class="theme-toggle" @click="theme.toggle()">
          {{ theme.isDark ? '☀️' : '🌙' }}
        </button>
        <button class="btn btn-ghost btn-sm" @click="handleLogout">{{ t('nav.logout') }}</button>
      </div>
    </header>

    <!-- Content -->
    <main class="member-content">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { RouterView, RouterLink, useRouter } from 'vue-router'
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
const lang = computed(() => langStore.lang)

function setLang(l) { langStore.setLang(l) }
function handleLogout() { audio.stopPlayback(); auth.logout(); router.push('/login') }

onMounted(() => {
  audio.initForPage(false)
})
</script>

<style scoped>
.member-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.member-header {
  height: 64px;
  background: rgba(13,10,8,0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  gap: 1rem;
  position: sticky;
  top: 0;
  z-index: 50;
}

[data-theme="light"] .member-header {
  background: rgba(250, 247, 242, 0.8);
}

.member-logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.member-content {
  flex: 1;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
  padding: 2rem 1.5rem;
}

.topbar-music-btn {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 9999px;
  width: 34px;
  height: 34px;
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
  height: 14px;
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

@media (max-width: 640px) {
  .member-header {
    padding: 0.5rem 0.85rem;
    height: auto;
    min-height: 56px;
    flex-wrap: wrap;
  }
  .member-content {
    padding: 1rem 0.85rem;
  }
  .topbar-actions {
    flex-wrap: wrap;
    gap: 0.4rem;
  }
}
</style>
