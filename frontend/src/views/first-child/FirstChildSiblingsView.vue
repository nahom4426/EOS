<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">👨‍👩‍👧‍👦 My Family Members</h1>
        <p class="page-subtitle">Register and manage siblings under your family group</p>
      </div>
      <button class="btn btn-primary" @click="openRegisterModal">
        ＋ Register Sibling
      </button>
    </div>

    <div class="page-content">
      <!-- Stats row -->
      <div class="grid-3 mb-3">
        <div class="stat-card">
          <div class="stat-icon gold">👥</div>
          <div>
            <div class="stat-value">{{ siblings.length }}</div>
            <div class="stat-label">Total Siblings</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon success">✅</div>
          <div>
            <div class="stat-value">{{ siblings.filter(s => s.paid_this_month).length }}</div>
            <div class="stat-label">Paid This Month</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon crimson">⏳</div>
          <div>
            <div class="stat-value">{{ siblings.filter(s => !s.paid_this_month).length }}</div>
            <div class="stat-label">Unpaid This Month</div>
          </div>
        </div>
      </div>

      <!-- Sibling list -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Registered Siblings</h3>
          <div class="toolbar" style="margin:0;padding:0;border:none;background:none;">
            <div class="search-bar" style="min-width:200px;">
              <span class="search-icon">🔍</span>
              <input v-model="search" type="text" placeholder="Search siblings..." @input="searchSiblings" />
            </div>
          </div>
        </div>
        <div class="card-body" style="padding:0;">
          <div v-if="loading" class="loading-overlay"><div class="spinner"></div></div>
          <div v-else-if="!siblings.length" class="empty-state" style="padding:3rem;">
            <div class="empty-icon">👨‍👩‍👧‍👦</div>
            <div class="empty-text">No siblings registered yet. Register your first family member!</div>
          </div>
          <div v-else>
            <div v-for="s in siblings" :key="s.id" class="sibling-row">
              <!-- Avatar -->
              <div class="sibling-avatar">
                <img v-if="s.avatar_url" :src="s.avatar_url" class="avatar-img" />
                <div v-else class="avatar-placeholder">{{ s.full_name?.charAt(0) }}</div>
              </div>
              <!-- Info -->
              <div style="flex:1;min-width:0;">
                <div class="sibling-name">{{ s.full_name }}</div>
                <div class="sibling-meta">
                  📞 {{ s.phone }}
                  <span v-if="s.branch_name" class="badge badge-gold" style="font-size:0.68rem;margin-left:0.4rem;">{{ s.branch_name }}</span>
                </div>
                <!-- Tier badge -->
                <div v-if="s.tier" class="sibling-tier" :style="{ color: s.tierColor }">
                  {{ s.tierBadge }} {{ s.tier }} · Score: {{ s.score }}/100
                </div>
              </div>
              <!-- Status -->
              <div style="text-align:center;min-width:80px;">
                <span :class="['badge', s.paid_this_month ? 'badge-success' : 'badge-warning']">
                  {{ s.paid_this_month ? '✓ Paid' : '⏳ Unpaid' }}
                </span>
              </div>
              <!-- Actions -->
              <div class="sibling-actions">
                <button
                  class="btn btn-primary btn-sm"
                  @click="goLogContribution(s)"
                  title="Log contribution for this sibling"
                >
                  💰 Contribute
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Register Sibling Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">➕ Register New Sibling</span>
            <button class="btn btn-ghost btn-sm btn-icon" @click="showModal = false">✕</button>
          </div>
          <form @submit.prevent="registerSibling">
            <div class="modal-body" style="display:flex;flex-direction:column;gap:1rem;">
              <div v-if="formError" class="alert alert-danger">{{ formError }}</div>
              <div v-if="formSuccess" class="alert alert-success">
                ✅ {{ formSuccess }}
              </div>

              <div class="form-group">
                <label class="form-label">Full Name *</label>
                <input v-model="form.full_name" type="text" class="form-control" required placeholder="e.g. Meron Haile" />
              </div>

              <div class="form-group">
                <label class="form-label">Phone Number *</label>
                <input v-model="form.phone" type="tel" class="form-control" required placeholder="e.g. 0911234567" />
              </div>

              <div class="form-group">
                <label class="form-label">Password *</label>
                <input v-model="form.password" type="password" class="form-control" required placeholder="Set a login password" />
              </div>

              <div class="info-note">
                <span>ℹ️</span>
                <span>This sibling will be registered under your family group automatically. They can log in as a Member to view their contribution history.</span>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-ghost" @click="showModal = false">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="saving">
                <span v-if="saving" class="spinner spinner-sm"></span>
                Register Sibling
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../../api/axios'

const router = useRouter()

const siblings = ref([])
const loading = ref(false)
const saving = ref(false)
const showModal = ref(false)
const search = ref('')
const formError = ref('')
const formSuccess = ref('')

const form = ref({
  full_name: '',
  phone: '',
  password: '',
})

function openRegisterModal() {
  form.value = { full_name: '', phone: '', password: '' }
  formError.value = ''
  formSuccess.value = ''
  showModal.value = true
}

function goLogContribution(sibling) {
  // Navigate to contribution form with sibling pre-selected via query param
  router.push({
    path: '/first-child/contributions',
    query: { pre_member_id: sibling.id, pre_member_name: sibling.full_name }
  })
}

let searchTimer = null
function searchSiblings() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchSiblings(), 300)
}

async function fetchSiblings() {
  loading.value = true
  try {
    const params = { limit: 50 }
    if (search.value.trim()) params.search = search.value.trim()
    const res = await api.get('/api/members', { params })
    siblings.value = res.data.data || []
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function registerSibling() {
  formError.value = ''
  formSuccess.value = ''
  saving.value = true
  try {
    const res = await api.post('/api/members', {
      full_name: form.value.full_name.trim(),
      phone: form.value.phone.trim(),
      password: form.value.password,
    })
    formSuccess.value = `${res.data.full_name} registered successfully!`
    form.value = { full_name: '', phone: '', password: '' }
    await fetchSiblings()
    setTimeout(() => {
      formSuccess.value = ''
      showModal.value = false
    }, 2000)
  } catch (e) {
    formError.value = e.response?.data?.error || 'Registration failed. Please try again.'
  } finally {
    saving.value = false
  }
}

onMounted(() => fetchSiblings())
</script>

<style scoped>
.sibling-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.15s;
}

.sibling-row:last-child { border-bottom: none; }
.sibling-row:hover { background: var(--bg-glass); }

.sibling-avatar {
  flex-shrink: 0;
}

.avatar-img {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--gold);
}

.avatar-placeholder {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(212,175,55,0.2), rgba(139,26,26,0.2));
  border: 2px solid var(--gold);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--gold);
}

.sibling-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sibling-meta {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-top: 0.15rem;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.sibling-tier {
  font-size: 0.73rem;
  font-weight: 600;
  margin-top: 0.2rem;
}

.sibling-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.info-note {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.75rem;
  font-size: 0.82rem;
  color: var(--text-muted);
  line-height: 1.5;
}
</style>
