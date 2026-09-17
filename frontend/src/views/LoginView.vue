<template>
  <div class="login-page" @click="handleFirstInteraction">
    <!-- Vibrant Full-Color HD Church Cathedral Background -->
    <div class="hd-bg-container">
      <img src="/assets/images/church_bg.png" alt="Ethiopian Cathedral" class="hd-bg-image" />
      <div class="hd-bg-vignette"></div>
    </div>

    <!-- Ambient glowing gold light orbs -->
    <div class="ambient-orb orb-1"></div>
    <div class="ambient-orb orb-2"></div>
    <div class="ambient-orb orb-3"></div>

    <!-- Gold dust particle elements -->
    <div class="gold-particles">
      <div v-for="n in 12" :key="n" class="particle" :style="getParticleStyle(n)"></div>
    </div>

    <!-- Centered Container -->
    <div class="centered-login-container">
      <!-- Centered Glass Mirror Card -->
      <div class="sleek-glass-card">
        <div class="glass-glare"></div>

        <div class="card-inner">
          <!-- Logo & Header inside card -->
          <div class="card-header-emblem">
            <div class="cross-thumb-wrapper">
              <img src="/assets/images/orthodox_logo.svg" alt="Ethiopian Orthodox Cross" class="cross-thumb-img" style="filter:drop-shadow(0 0 10px rgba(212,175,55,0.6));" />
              <div class="cross-thumb-glow"></div>
            </div>
            <h1 class="brand-title">የኢትዮጵያ ኦርቶዶክስ ተዋሕዶ</h1>
            <p class="brand-subtitle">
              {{ lang === 'en' ? 'Ethiopian Orthodox Tewahedo Church' : 'የኢትዮጵያ ኦርቶዶክስ ተዋሕዶ ቤተ ክርስቲያን' }}
            </p>
            <div class="system-chip">
              <span>✝</span>
              {{ lang === 'en' ? 'Contribution Management System' : 'የመዋጮና የአባልነት አስተዳደር ስርዓት' }}
            </div>
          </div>

          <!-- Top Language, Theme & Classical Audio Controls Bar -->
          <div class="card-top-controls">
            <h2 class="card-action-title">{{ t('login.title') }}</h2>
            <div class="controls-right">
              <!-- Classical Audio Toggle -->
              <button
                class="music-btn-glass"
                :class="{ playing: audio.isMusicPlaying }"
                @click.stop="audio.toggleMusic()"
                :title="audio.isMusicPlaying ? 'Mute Orthodox Classical Mezmur' : 'Play Orthodox Classical Mezmur'"
              >
                <div v-if="audio.isMusicPlaying" class="audio-equalizer">
                  <span class="eq-bar bar-1"></span>
                  <span class="eq-bar bar-2"></span>
                  <span class="eq-bar bar-3"></span>
                </div>
                <span v-else class="music-icon">🔇</span>
              </button>

              <!-- Language Toggle -->
              <div class="lang-toggle-glass">
                <button class="lang-btn-glass" :class="{ active: lang === 'en' }" @click="setLang('en')">EN</button>
                <button class="lang-btn-glass" :class="{ active: lang === 'am' }" @click="setLang('am')">አማ</button>
              </div>

              <!-- Theme Toggle -->
              <button class="theme-btn-glass" @click="theme.toggle()" :title="theme.isDark ? 'Light Mode' : 'Dark Mode'">
                {{ theme.isDark ? '☀️' : '🌙' }}
              </button>
            </div>
          </div>

          <!-- Error Alert -->
          <Transition name="fade-slide">
            <div v-if="error" class="glass-alert alert-error">
              <span class="alert-icon">⚠️</span>
              <span>{{ error }}</span>
            </div>
          </Transition>

          <!-- Login Form -->
          <form @submit.prevent="handleLogin" autocomplete="off">
            <div class="input-group">
              <label class="glass-label">{{ t('login.phone') }}</label>
              <div class="input-wrapper">
                <span class="input-icon">📱</span>
                <input
                  id="phone"
                  v-model="phone"
                  type="tel"
                  class="glass-input"
                  :placeholder="lang === 'en' ? 'Phone number (e.g. 0911000000)' : 'ስልክ ቁጥር ያስገቡ (ምሳሌ 0911000000)'"
                  required
                  autocomplete="tel"
                />
              </div>
            </div>

            <div class="input-group">
              <label class="glass-label">{{ t('login.password') }}</label>
              <div class="input-wrapper">
                <span class="input-icon">🔒</span>
                <input
                  id="password"
                  v-model="password"
                  :type="showPass ? 'text' : 'password'"
                  class="glass-input"
                  :placeholder="t('login.password')"
                  required
                  autocomplete="current-password"
                  style="padding-right: 3rem;"
                />
                <button
                  type="button"
                  class="pass-toggle-btn"
                  @click="showPass = !showPass"
                >
                  {{ showPass ? '🙈' : '👁️' }}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              class="glass-btn-primary"
              :disabled="loading"
            >
              <div class="btn-glow"></div>
              <span v-if="loading" class="spinner-light"></span>
              <span v-else class="btn-text">
                {{ t('login.submit') }}
                <span class="arrow-icon">➔</span>
              </span>
            </button>
          </form>

          <!-- Demo Quick Fill Chips (Development Only) -->
          <div v-if="isDev" class="demo-section">
            <div class="demo-title">
              <span>⚡ {{ lang === 'en' ? 'Quick Demo Fill:' : 'ፈጣን መግቢያ:' }}</span>
            </div>
            <div class="demo-chips">
              <button class="demo-chip" @click="fillDemo('0911000000', 'Admin@1234')">
                👑 Superadmin
              </button>
              <button class="demo-chip" @click="fillDemo('0922000001', 'BranchAdmin@1')">
                🏛️ Branch Admin
              </button>
              <button class="demo-chip" @click="fillDemo('0933000002', 'Member@1')">
                👤 Member
              </button>
            </div>
          </div>

          <!-- Sacred Candle Footer -->
          <div class="candle-row">
            <div class="candle-flame-wrapper">
              <span class="candle-flame">🕯️</span>
              <div class="flame-aura"></div>
            </div>
            <div class="candle-text">
              <span class="line-left"></span>
              <span class="cross-small">✝</span>
              <span class="line-right"></span>
            </div>
            <div class="candle-flame-wrapper">
              <span class="candle-flame">🕯️</span>
              <div class="flame-aura"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { useLangStore } from '../stores/lang'
import { useThemeStore } from '../stores/theme'
import { useAudioStore } from '../stores/audio'
import { getHomeRoute } from '../router/index'
import api from '../api/axios'

const { t } = useI18n()
const auth = useAuthStore()
const langStore = useLangStore()
const theme = useThemeStore()
const audio = useAudioStore()
const router = useRouter()

const lang = computed(() => langStore.lang)
const isDev = computed(() => import.meta.env.DEV)
const phone = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const showPass = ref(false)

function setLang(l) { langStore.setLang(l) }

function fillDemo(p, pw) {
  phone.value = p
  password.value = pw
  error.value = ''
}

/* ── Classical Audio Engine (Supports MP3 & Begena Synthesizer) ──── */
let audioElem = null
let audioCtx = null
let musicTimer = null
let masterGain = null
let hasUserInteracted = false
const audioSetting = ref({ track: 'custom_audio', custom_url: '/assets/audio/orthodox_classical.mp3' })

const begenaScale = [146.83, 164.81, 196.00, 220.00, 261.63, 293.66, 329.63, 392.00]

async function loadClassicalSetting() {
  try {
    const res = await api.get('/api/settings/login-classical')
    audioSetting.value = res.data
  } catch (e) {
    console.warn('Using default classical audio:', e)
  }
}

function startAudioPlayback() {
  if (!isMusicPlaying.value) return

  if (audioSetting.value.track === 'custom_audio' || audioSetting.value.custom_url) {
    // Play MP3 audio (e.g. የፍቅር እናት የሰላም Classical Orthodox Mezmur)
    if (!audioElem) {
      audioElem = new Audio(audioSetting.value.custom_url || '/assets/audio/orthodox_classical.mp3')
      audioElem.loop = true
      audioElem.volume = 0.5
    }
    audioElem.play().then(() => {
      isMusicPlaying.value = true
    }).catch(err => {
      console.log('Autoplay waiting for user interaction:', err.message)
    })
  } else {
    // Play Web Audio Begena Synthesizer
    startBegenaLoop()
  }
}

function handleFirstInteraction() {
  if (!hasUserInteracted) {
    hasUserInteracted = true
    if (audio.isMusicPlaying) {
      audio.startPlayback()
    }
  }
}

onMounted(async () => {
  await audio.initForPage(true)
})

onUnmounted(() => {
  // Keep playing if user navigated inside or stop if needed
})

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    const user = await auth.login(phone.value, password.value)
    audio.stopPlayback()
    router.push(getHomeRoute(user.role))
  } catch (err) {
    error.value = err.response?.data?.error || t('login.error')
  } finally {
    loading.value = false
  }
}

function initAudioEngine() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    audioCtx = new AudioContextClass()
    masterGain = audioCtx.createGain()
    masterGain.gain.setValueAtTime(0.18, audioCtx.currentTime)
    masterGain.connect(audioCtx.destination)
  }
}

function playBegenaNote(freq, duration = 2.5) {
  if (!audioCtx || audioCtx.state === 'closed') return

  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  const filter = audioCtx.createBiquadFilter()

  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime)

  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(1200, audioCtx.currentTime)
  filter.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + duration)

  const now = audioCtx.currentTime
  gain.gain.setValueAtTime(0.001, now)
  gain.gain.linearRampToValueAtTime(0.35, now + 0.04)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  osc.connect(filter)
  filter.connect(gain)
  gain.connect(masterGain)

  osc.start(now)
  osc.stop(now + duration)
}

function startBegenaLoop() {
  initAudioEngine()
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }

  let step = 0
  const arpeggio = [0, 2, 4, 3, 5, 2, 1, 4, 0, 3, 2, 5]

  function tick() {
    if (!isMusicPlaying.value) return
    const index = arpeggio[step % arpeggio.length]
    const freq = begenaScale[index]
    playBegenaNote(freq, 2.8)

    if (step % 4 === 0) {
      playBegenaNote(begenaScale[0] / 2, 4.0)
    }

    step++
    musicTimer = setTimeout(tick, 650)
  }

  tick()
}

function stopAudio() {
  if (audioElem) {
    audioElem.pause()
  }
  if (musicTimer) {
    clearTimeout(musicTimer)
    musicTimer = null
  }
  if (audioCtx && audioCtx.state === 'running') {
    audioCtx.suspend()
  }
}

function getParticleStyle(n) {
  const left = (n * 8.3) % 100
  const duration = 6 + (n % 5) * 2
  const delay = (n % 4) * 1.5
  const size = 3 + (n % 3) * 2
  return {
    left: `${left}%`,
    animationDuration: `${duration}s`,
    animationDelay: `${delay}s`,
    width: `${size}px`,
    height: `${size}px`,
  }
}
</script>

<style scoped>
/* ── Container & Background ───────────────────────────────── */
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1rem;
  position: relative;
  overflow: hidden;
  background: var(--bg-primary);
}

/* ── Vibrant Full-Color HD Background ─────────────────────── */
.hd-bg-container {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
}

.hd-bg-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.72;
  filter: contrast(110%) brightness(110%) saturate(120%);
  animation: cinematicPan 35s ease-in-out infinite alternate;
}

[data-theme="light"] .hd-bg-image {
  opacity: 0.65;
  filter: contrast(105%) brightness(115%) saturate(110%);
}

@keyframes cinematicPan {
  0% { transform: scale(1) translate(0, 0); }
  50% { transform: scale(1.08) translate(-15px, -10px); }
  100% { transform: scale(1.03) translate(15px, 10px); }
}

.hd-bg-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 50%, rgba(13, 10, 8, 0.25) 0%, rgba(13, 10, 8, 0.75) 100%),
              linear-gradient(180deg, rgba(13, 10, 8, 0.5) 0%, transparent 40%, rgba(13, 10, 8, 0.7) 100%);
}

[data-theme="light"] .hd-bg-vignette {
  background: radial-gradient(circle at 50% 50%, rgba(250, 247, 242, 0.3) 0%, rgba(250, 247, 242, 0.75) 100%);
}

/* ── Glowing Orbs ──────────────────────────────────────────── */
.ambient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
  opacity: 0.55;
  z-index: 2;
  animation: orbFloat 14s ease-in-out infinite alternate;
}

.orb-1 {
  width: 450px;
  height: 450px;
  background: radial-gradient(circle, rgba(212, 175, 55, 0.45), transparent 70%);
  top: -100px;
  left: 20%;
}

.orb-2 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(139, 26, 26, 0.55), transparent 70%);
  bottom: -120px;
  right: 15%;
  animation-delay: -5s;
}

.orb-3 {
  width: 350px;
  height: 350px;
  background: radial-gradient(circle, rgba(212, 175, 55, 0.35), transparent 70%);
  top: 40%;
  left: 65%;
  animation-delay: -9s;
}

@keyframes orbFloat {
  0% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(30px, -40px) scale(1.1); }
  100% { transform: translate(-20px, 30px) scale(0.95); }
}

/* ── Gold Dust Floating Particles ────────────────────────── */
.gold-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
}

.particle {
  position: absolute;
  bottom: -20px;
  background: var(--gold);
  border-radius: 50%;
  box-shadow: 0 0 12px var(--gold);
  opacity: 0;
  animation: particleFloat infinite ease-in;
}

@keyframes particleFloat {
  0% { opacity: 0; transform: translateY(0) scale(0.5); }
  20% { opacity: 0.85; }
  80% { opacity: 0.85; }
  100% { opacity: 0; transform: translateY(-100vh) scale(1.3); }
}

/* ── Centered Container & Glass Mirror Card ───────────────── */
.centered-login-container {
  width: 100%;
  max-width: 470px;
  position: relative;
  z-index: 10;
}

.sleek-glass-card {
  position: relative;
  background: rgba(18, 12, 8, 0.72);
  backdrop-filter: blur(32px) saturate(200%);
  -webkit-backdrop-filter: blur(32px) saturate(200%);
  border: 1.5px solid rgba(212, 175, 55, 0.35);
  border-radius: 28px;
  box-shadow: 
    0 35px 75px -15px rgba(0, 0, 0, 0.85),
    0 0 50px rgba(212, 175, 55, 0.2),
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.25);
  overflow: hidden;
  transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.4s ease;
}

[data-theme="light"] .sleek-glass-card {
  background: rgba(255, 252, 246, 0.85);
  border-color: rgba(139, 26, 26, 0.28);
  box-shadow: 
    0 30px 65px -15px rgba(92, 14, 14, 0.2),
    0 0 40px rgba(212, 175, 55, 0.2),
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.85);
}

.sleek-glass-card:hover {
  transform: translateY(-2px);
  border-color: rgba(212, 175, 55, 0.55);
  box-shadow: 
    0 40px 85px -15px rgba(0, 0, 0, 0.9),
    0 0 70px rgba(212, 175, 55, 0.3),
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.35);
}

/* Glass Sheen Shimmer Reflection Sweep */
.glass-glare {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    45deg,
    transparent 45%,
    rgba(255, 255, 255, 0.06) 48%,
    rgba(212, 175, 55, 0.12) 50%,
    rgba(255, 255, 255, 0.06) 52%,
    transparent 55%
  );
  transform: rotate(30deg);
  pointer-events: none;
  animation: glassSweep 12s ease-in-out infinite;
}

@keyframes glassSweep {
  0% { transform: translateY(-30%) rotate(30deg); }
  50% { transform: translateY(30%) rotate(30deg); }
  100% { transform: translateY(-30%) rotate(30deg); }
}

.card-inner {
  padding: 2.5rem 2.25rem;
  position: relative;
  z-index: 2;
}

/* ── Card Header Emblem ───────────────────────────────────── */
.card-header-emblem {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1.5rem;
}

.cross-thumb-wrapper {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.75rem;
}

.cross-thumb-img {
  width: 68px;
  height: 68px;
  object-fit: cover;
  border-radius: 50%;
  border: 2px solid var(--gold);
  position: relative;
  z-index: 2;
  box-shadow: 0 0 20px rgba(212, 175, 55, 0.5);
  animation: crossFloat 4s ease-in-out infinite alternate;
}

@keyframes crossFloat {
  0% { transform: translateY(0) scale(1); }
  100% { transform: translateY(-5px) scale(1.05); }
}

.cross-thumb-glow {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(212, 175, 55, 0.5) 0%, transparent 70%);
  animation: auraPulse 2.5s ease-in-out infinite alternate;
}

@keyframes auraPulse {
  0% { opacity: 0.4; transform: scale(0.9); }
  100% { opacity: 0.95; transform: scale(1.15); }
}

.brand-title {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #FFFDF8 0%, #D4AF37 50%, #F0D060 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 2px 10px rgba(212,175,55,0.25));
}

[data-theme="light"] .brand-title {
  background: linear-gradient(135deg, #5C0E0E 0%, #8B1A1A 50%, #D4AF37 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-subtitle {
  color: var(--text-secondary);
  font-size: 0.88rem;
  font-weight: 500;
  margin-top: 0.2rem;
}

.system-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.5rem;
  padding: 0.25rem 0.85rem;
  background: rgba(212, 175, 55, 0.1);
  border: 1px solid rgba(212, 175, 55, 0.28);
  border-radius: 999px;
  color: var(--gold);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  backdrop-filter: blur(10px);
}

/* ── Top Controls ─────────────────────────────────────────── */
.card-top-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(212, 175, 55, 0.18);
}

.card-action-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--gold);
}

.controls-right {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

/* ── Music Button & Equalizer ─────────────────────────────── */
.music-btn-glass {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(212, 175, 55, 0.25);
  background: rgba(0, 0, 0, 0.35);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s ease;
}

.music-btn-glass.playing {
  border-color: var(--gold);
  background: rgba(212, 175, 55, 0.15);
  box-shadow: 0 0 15px rgba(212, 175, 55, 0.4);
}

.music-btn-glass:hover {
  border-color: var(--gold);
  transform: scale(1.08);
}

.music-icon {
  font-size: 1rem;
}

.audio-equalizer {
  display: flex;
  align-items: flex-end;
  gap: 2.5px;
  height: 14px;
}

.eq-bar {
  width: 3px;
  background: var(--gold);
  border-radius: 2px;
  animation: eqBounce 1s ease-in-out infinite alternate;
}

.bar-1 { height: 12px; animation-delay: 0.1s; }
.bar-2 { height: 14px; animation-delay: 0.3s; }
.bar-3 { height: 10px; animation-delay: 0.5s; }

@keyframes eqBounce {
  0% { transform: scaleY(0.3); }
  100% { transform: scaleY(1); }
}

.lang-toggle-glass {
  display: flex;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(212, 175, 55, 0.22);
  border-radius: 999px;
  padding: 3px;
  gap: 2px;
  backdrop-filter: blur(10px);
}

[data-theme="light"] .lang-toggle-glass {
  background: rgba(139, 26, 26, 0.06);
}

.lang-btn-glass {
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s ease;
}

.lang-btn-glass.active {
  background: linear-gradient(135deg, var(--gold), var(--gold-dim));
  color: var(--text-inverse);
  box-shadow: 0 2px 10px rgba(212, 175, 55, 0.4);
}

.theme-btn-glass {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(212, 175, 55, 0.22);
  background: rgba(0, 0, 0, 0.35);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s ease;
  font-size: 1rem;
}

.theme-btn-glass:hover {
  border-color: var(--gold);
  transform: scale(1.08);
  box-shadow: 0 0 15px rgba(212, 175, 55, 0.3);
}

[data-theme="light"] .theme-btn-glass {
  background: rgba(139, 26, 26, 0.06);
  border-color: rgba(139, 26, 26, 0.22);
}

/* ── Alerts ───────────────────────────────────────────────── */
.glass-alert {
  padding: 0.85rem 1.1rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  backdrop-filter: blur(12px);
}

.alert-error {
  background: rgba(224, 82, 82, 0.18);
  border: 1px solid rgba(224, 82, 82, 0.4);
  color: #FF6B6B;
}

/* ── Inputs ───────────────────────────────────────────────── */
.input-group {
  margin-bottom: 1.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.glass-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 1rem;
  font-size: 1.05rem;
  color: var(--text-muted);
  pointer-events: none;
  transition: color 0.25s ease;
}

.glass-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.38);
  border: 1.5px solid rgba(212, 175, 55, 0.25);
  border-radius: 14px;
  padding: 0.85rem 1rem 0.85rem 2.8rem;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.95rem;
  transition: all 0.25s ease;
  outline: none;
}

[data-theme="light"] .glass-input {
  background: rgba(255, 255, 255, 0.7);
  border-color: rgba(139, 26, 26, 0.22);
}

.glass-input:focus {
  border-color: var(--gold);
  background: rgba(0, 0, 0, 0.55);
  box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.2), 0 0 20px rgba(212, 175, 55, 0.2);
}

[data-theme="light"] .glass-input:focus {
  background: #FFFFFF;
}

.pass-toggle-btn {
  position: absolute;
  right: 0.85rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  color: var(--text-muted);
  transition: transform 0.2s ease, color 0.2s ease;
  padding: 0.2rem;
}

.pass-toggle-btn:hover {
  transform: scale(1.15);
  color: var(--gold);
}

/* ── Primary Submit Button ────────────────────────────────── */
.glass-btn-primary {
  width: 100%;
  margin-top: 1rem;
  padding: 1rem 1.75rem;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #D4AF37 0%, #B89320 50%, #8B6B10 100%);
  color: #0D0A08;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: 0 8px 25px rgba(212, 175, 55, 0.35);
}

.glass-btn-primary:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.01);
  box-shadow: 0 12px 35px rgba(212, 175, 55, 0.55);
  background: linear-gradient(135deg, #F0D060 0%, #D4AF37 50%, #A88B2A 100%);
}

.glass-btn-primary:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.btn-glow {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.45) 0%, transparent 60%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.glass-btn-primary:hover .btn-glow {
  opacity: 1;
}

.btn-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  position: relative;
  z-index: 2;
}

.arrow-icon {
  font-size: 1.1rem;
  transition: transform 0.25s ease;
}

.glass-btn-primary:hover .arrow-icon {
  transform: translateX(4px);
}

/* ── Demo Chips ───────────────────────────────────────────── */
.demo-section {
  margin-top: 1.75rem;
  padding-top: 1.25rem;
  border-top: 1px dashed rgba(212, 175, 55, 0.25);
}

.demo-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  margin-bottom: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.demo-chips {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.demo-chip {
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.1);
  border: 1px solid rgba(212, 175, 55, 0.28);
  color: var(--text-primary);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
}

.demo-chip:hover {
  background: rgba(212, 175, 55, 0.25);
  border-color: var(--gold);
  color: var(--gold);
  transform: translateY(-1px);
}

/* ── Sacred Candle Footer ─────────────────────────────────── */
.candle-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.candle-flame-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.candle-flame {
  font-size: 1.5rem;
  animation: candleFlicker 3s ease-in-out infinite alternate;
}

.flame-aura {
  position: absolute;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 180, 50, 0.55) 0%, transparent 70%);
  animation: auraPulse 2s ease-in-out infinite alternate;
}

@keyframes candleFlicker {
  0% { transform: scale(1) rotate(-1deg); }
  25% { transform: scale(1.08) rotate(1deg); }
  50% { transform: scale(0.95) rotate(-2deg); }
  75% { transform: scale(1.05) rotate(2deg); }
  100% { transform: scale(1) rotate(-1deg); }
}

.candle-text {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.line-left, .line-right {
  width: 40px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold));
}

.line-right {
  background: linear-gradient(90deg, var(--gold), transparent);
}

.cross-small {
  color: var(--gold);
  font-size: 0.9rem;
  font-weight: 700;
}

.spinner-light {
  width: 20px;
  height: 20px;
  border: 2.5px solid rgba(0, 0, 0, 0.2);
  border-top-color: #0D0A08;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Transitions */
.fade-slide-enter-active, .fade-slide-leave-active {
  transition: all 0.3s ease;
}
.fade-slide-enter-from, .fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 520px) {
  .login-page {
    padding: 1rem 0.5rem;
  }
  .card-inner {
    padding: 1.5rem 1.15rem;
  }
  .brand-title {
    font-size: 1.5rem;
  }
  .card-top-controls {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .controls-right {
    width: 100%;
    justify-content: space-between;
  }
  .demo-chips {
    flex-direction: column;
  }
  .demo-chip {
    width: 100%;
    text-align: center;
  }
}
</style>
