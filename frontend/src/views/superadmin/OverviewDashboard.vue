<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('superadmin.overview') }}</h1>
        <p class="page-subtitle">{{ t('superadmin.selectMonth') }}</p>
      </div>
      <div class="topbar-actions">
        <input
          type="month"
          class="form-control"
          v-model="selectedMonth"
          @change="fetchOverview"
          style="width:160px;"
        />
        <button class="btn btn-ghost btn-sm" @click="selectedMonth=''; fetchOverview()">
          {{ t('common.all') }}
        </button>
      </div>
    </div>

    <div class="page-content">
      <!-- Grand total banner -->
      <div class="grand-total-banner card mb-3" v-if="!loading">
        <div class="grand-total-inner">
          <div class="grand-total-icon">💰</div>
          <div>
            <div class="grand-total-label">{{ t('reports.grandTotal') }}</div>
            <div class="grand-total-value">{{ formatCurrency(overview.grand_total || 0) }}</div>
          </div>
          <div class="grand-total-meta">
            <span class="badge badge-gold">{{ overview.branches?.length || 0 }} {{ t('nav.branches') }}</span>
          </div>
        </div>
      </div>

      <!-- Stats grid -->
      <div class="grid-3 mb-3" v-if="!loading">
        <div class="stat-card">
          <div class="stat-icon gold">🏛️</div>
          <div>
            <div class="stat-value">{{ overview.branches?.length || 0 }}</div>
            <div class="stat-label">{{ t('superadmin.totalBranches') }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon success">👥</div>
          <div>
            <div class="stat-value">{{ totalMembers }}</div>
            <div class="stat-label">{{ t('superadmin.totalMembers') }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon crimson">💵</div>
          <div>
            <div class="stat-value">{{ formatCurrency(overview.grand_total || 0) }}</div>
            <div class="stat-label">{{ t('superadmin.totalCollected') }}</div>
          </div>
        </div>
      </div>

      <!-- Classical Audio Control Card for Superadmin -->
      <div class="card mb-3 audio-settings-card">
        <div class="card-header d-flex align-items-center justify-content-between">
          <div class="d-flex align-items-center gap-2">
            <span style="font-size: 1.5rem;">🎵</span>
            <div>
              <h3 style="color:var(--gold); margin: 0; font-weight: 700;">Classical Orthodox Music Settings</h3>
              <p class="text-muted" style="margin: 0; font-size: 0.85rem;">
                Select or upload active background audio track played on system pages
              </p>
            </div>
          </div>
          <span class="badge badge-gold">Superadmin Control</span>
        </div>
        <div class="card-body">
          <form @submit.prevent="saveAudioSettings" class="audio-form">
            <div class="form-row align-items-end">
              <div class="form-group flex-1">
                <label class="form-label" style="font-weight: 600;">Active Audio Track</label>
                <select class="form-control" v-model="selectedTrack">
                  <option value="custom_audio">🎵 Default Orthodox Mezmur (የፍቅር እናት የሰላም - Classical MP3)</option>
                  <option value="begena_synthesizer">🪕 Begena Pentatonic Harp (Web Audio Synthesizer)</option>
                  <option value="custom_url">🔗 Custom Audio File / Imported Track</option>
                </select>
              </div>

              <div class="form-group flex-1" v-if="selectedTrack === 'custom_url'">
                <label class="form-label" style="font-weight: 600;">Audio URL / Path</label>
                <input
                  type="text"
                  class="form-control"
                  v-model="customUrl"
                  placeholder="/uploads/audio/... or https://..."
                  required
                />
              </div>

              <div class="form-group d-flex gap-2 flex-wrap">
                <input
                  type="file"
                  ref="audioFileInput"
                  accept="audio/*,.mp3,.wav,.ogg,.m4a"
                  style="display: none;"
                  @change="handleAudioUpload"
                />
                <button
                  type="button"
                  class="btn btn-secondary"
                  :disabled="uploadingAudio"
                  @click="$refs.audioFileInput.click()"
                  title="Import .mp3, .wav, or .m4a file from computer"
                >
                  <span v-if="uploadingAudio" class="spinner-sm"></span>
                  <span v-else>📁 Import Audio File</span>
                </button>

                <button
                  type="button"
                  class="btn btn-ghost"
                  @click="toggleAudioPreview"
                  :title="isPreviewing ? 'Stop Preview' : 'Preview Selected Track'"
                  style="border: 1px solid var(--border-color);"
                >
                  <span v-if="isPreviewing">⏸️ Pause Preview</span>
                  <span v-else>▶️ Preview Track</span>
                </button>

                <button type="submit" class="btn btn-primary" :disabled="savingAudio">
                  <span v-if="savingAudio" class="spinner-sm"></span>
                  <span v-else>💾 Save Setting</span>
                </button>
              </div>
            </div>

            <div v-if="audioMsg" class="alert alert-success mt-2" style="padding: 0.5rem 1rem; border-radius: 8px;">
              ✅ {{ audioMsg }}
            </div>
            <div v-if="audioError" class="alert alert-error mt-2" style="padding: 0.5rem 1rem; border-radius: 8px;">
              ⚠️ {{ audioError }}
            </div>
          </form>
        </div>
      </div>

      <!-- Branch table -->
      <div class="card">
        <div class="card-header">
          <h3 style="color:var(--gold);">{{ t('reports.byBranch') }}</h3>
        </div>
        <div class="card-body" style="padding:0;">
          <div v-if="loading" class="loading-overlay"><div class="spinner"></div></div>
          <div v-else-if="!overview.branches?.length" class="empty-state">
            <div class="empty-icon">🏛️</div>
            <div class="empty-text">{{ t('common.noData') }}</div>
          </div>
          <div v-else class="table-wrapper" style="border:none;border-radius:0;">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ t('branches.branchName') }}</th>
                  <th>{{ t('common.location') }}</th>
                  <th>{{ t('superadmin.totalMembers') }}</th>
                  <th>{{ t('reports.paidMembers') }}</th>
                  <th>{{ t('reports.totalCollected') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="b in overview.branches" :key="b.branch_id">
                  <td>
                    <span style="font-weight:600;">{{ b.branch_name }}</span>
                  </td>
                  <td class="text-muted">{{ b.location || '—' }}</td>
                  <td>{{ b.total_members }}</td>
                  <td>
                    <span class="badge badge-success">{{ b.paying_members }}</span>
                  </td>
                  <td>
                    <span style="font-weight:700;color:var(--gold);">{{ formatCurrency(b.total_collected) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAudioStore } from '../../stores/audio'
import api from '../../api/axios'

const { t } = useI18n()
const audio = useAudioStore()
const loading = ref(false)
const overview = ref({ branches: [], grand_total: 0 })
const selectedMonth = ref('')

const selectedTrack = ref('custom_audio')
const customUrl = ref('/assets/audio/orthodox_classical.mp3')
const savingAudio = ref(false)
const uploadingAudio = ref(false)
const isPreviewing = ref(false)
const audioMsg = ref('')
const audioError = ref('')
const audioFileInput = ref(null)

const totalMembers = computed(() =>
  (overview.value.branches || []).reduce((s, b) => s + parseInt(b.total_members || 0), 0)
)

function formatCurrency(val) {
  return new Intl.NumberFormat('en-ET', { minimumFractionDigits: 2 }).format(val) + ' ETB'
}

async function fetchAudioSetting() {
  try {
    const res = await api.get('/api/settings/login-classical')
    if (res.data) {
      selectedTrack.value = res.data.track || 'custom_audio'
      customUrl.value = res.data.custom_url || '/assets/audio/orthodox_classical.mp3'
    }
  } catch (e) {
    console.error('Failed to load audio settings:', e)
  }
}

function getSelectedSetting() {
  return {
    track: selectedTrack.value,
    custom_url: selectedTrack.value === 'custom_audio' ? '/assets/audio/orthodox_classical.mp3' : customUrl.value,
  }
}

function toggleAudioPreview() {
  if (isPreviewing.value) {
    audio.stopPlayback()
    isPreviewing.value = false
  } else {
    audio.updateSettingAndPlay(getSelectedSetting())
    isPreviewing.value = true
  }
}

async function handleAudioUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  uploadingAudio.value = true
  audioMsg.value = ''
  audioError.value = ''

  const formData = new FormData()
  formData.append('audio', file)

  try {
    const res = await api.post('/api/settings/upload-audio', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    selectedTrack.value = 'custom_url'
    customUrl.value = res.data.custom_url
    audio.updateSettingAndPlay({ track: 'custom_url', custom_url: res.data.custom_url })
    isPreviewing.value = true
    audioMsg.value = `Audio file "${file.name}" imported and activated instantly!`
    setTimeout(() => { audioMsg.value = '' }, 5000)
  } catch (err) {
    audioError.value = err.response?.data?.error || 'Failed to upload audio file'
  } finally {
    uploadingAudio.value = false
    if (audioFileInput.value) audioFileInput.value.value = ''
  }
}

async function saveAudioSettings() {
  savingAudio.value = true
  audioMsg.value = ''
  audioError.value = ''
  try {
    const payload = getSelectedSetting()
    await api.put('/api/settings/login-classical', payload)
    
    // Instantly update active music playback across all open pages!
    audio.updateSettingAndPlay(payload)
    isPreviewing.value = true

    audioMsg.value = 'Classical Orthodox audio setting updated and active music track updated instantly!'
    setTimeout(() => { audioMsg.value = '' }, 5000)
  } catch (e) {
    audioError.value = e.response?.data?.error || 'Failed to save audio settings'
  } finally {
    savingAudio.value = false
  }
}

async function fetchOverview() {
  loading.value = true
  try {
    const params = selectedMonth.value ? { month: selectedMonth.value } : {}
    const res = await api.get('/api/reports/overview', { params })
    overview.value = res.data
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchOverview()
  fetchAudioSetting()
})
</script>

<style scoped>
.grand-total-banner {
  background: linear-gradient(135deg, rgba(139,26,26,0.3) 0%, rgba(212,175,55,0.08) 100%);
  border-color: rgba(212,175,55,0.3);
}

.grand-total-inner {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.5rem;
}

.grand-total-icon {
  font-size: 2.5rem;
}

.grand-total-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.grand-total-value {
  font-size: 2rem;
  font-weight: 800;
  color: var(--gold);
}

.grand-total-meta {
  margin-left: auto;
}

.audio-settings-card {
  border-color: rgba(212,175,55,0.25);
  background: var(--bg-card);
}

.audio-form .form-row {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.flex-1 {
  flex: 1;
  min-width: 250px;
}

@media (max-width: 600px) {
  .grand-total-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .grand-total-meta {
    margin-left: 0;
  }
}
</style>
