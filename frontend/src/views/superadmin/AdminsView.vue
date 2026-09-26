<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('admins.title') }}</h1>
        <p class="page-subtitle">Manage admin, mini-admin and first-child accounts · {{ pagination.total }} total</p>
      </div>
      <button class="btn btn-primary" @click="openModal()">
        ＋ {{ t('admins.addAdmin') }}
      </button>
    </div>

    <div class="page-content">
      <!-- Role filter tabs -->
      <div class="role-tabs mb-3">
        <button
          v-for="tab in ROLE_TABS"
          :key="tab.value"
          class="role-tab-btn"
          :class="{ active: roleFilter === tab.value }"
          @click="roleFilter = tab.value; fetchAdmins()"
        >{{ tab.label }}</button>
      </div>

      <div class="card">
        <div class="card-body" style="padding:0;">
          <div v-if="loading" class="loading-overlay"><div class="spinner"></div></div>
          <div v-else-if="!admins.length" class="empty-state">
            <div class="empty-icon">👤</div>
            <div class="empty-text">{{ t('common.noData') }}</div>
          </div>
          <div v-else>
            <div class="table-wrapper" style="border:none;border-radius:0;">
              <table class="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{{ t('common.name') }}</th>
                    <th>{{ t('common.phone') }}</th>
                    <th>Role</th>
                    <th>{{ t('common.branch') }}</th>
                    <th>Mini-Admin (for First Child)</th>
                    <th>{{ t('branches.createdAt') }}</th>
                    <th>{{ t('common.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(a, i) in admins" :key="a.id">
                    <td class="text-muted" style="font-size:0.8rem;">{{ i + 1 }}</td>
                    <td><span style="font-weight:600;">{{ a.full_name }}</span></td>
                    <td class="text-muted">{{ a.phone }}</td>
                    <td>
                      <span :class="['badge', roleClass(a.role)]">{{ roleLabel(a.role) }}</span>
                    </td>
                    <td>
                      <span class="badge badge-gold">{{ a.branch_name || '—' }}</span>
                    </td>
                    <td class="text-muted" style="font-size:0.8rem;">
                      {{ a.mini_admin_name || (a.role === 'first_child' ? '— (unassigned)' : '—') }}
                    </td>
                    <td class="text-muted" style="font-size:0.8rem;">{{ formatDate(a.created_at) }}</td>
                    <td>
                      <div class="flex gap-1">
                        <button class="btn btn-ghost btn-sm btn-icon" @click="openModal(a)">✏️</button>
                        <button class="btn btn-danger btn-sm btn-icon" @click="confirmDelete(a)">🗑️</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">{{ editing ? t('admins.editAdmin') : t('admins.addAdmin') }}</span>
            <button class="btn btn-ghost btn-sm btn-icon" @click="showModal = false">✕</button>
          </div>
          <form @submit.prevent="saveAdmin">
            <div class="modal-body" style="display:flex;flex-direction:column;gap:1rem;">
              <div v-if="formError" class="alert alert-danger">{{ formError }}</div>

              <div class="form-group">
                <label class="form-label">{{ t('common.name') }} *</label>
                <input v-model="form.full_name" type="text" class="form-control" required />
              </div>

              <div class="form-group">
                <label class="form-label">{{ t('common.phone') }} *</label>
                <input v-model="form.phone" type="tel" class="form-control" required />
              </div>

              <div class="form-group">
                <label class="form-label">{{ editing ? t('admins.newPassword') : t('admins.password') + ' *' }}</label>
                <input v-model="form.password" type="password" class="form-control" :required="!editing" />
              </div>

              <div class="form-group">
                <label class="form-label">Role *</label>
                <select v-model="form.role" class="form-control" required :disabled="!!editing">
                  <option value="admin">Admin (Branch Manager)</option>
                  <option value="mini_admin">Mini-Admin (Cash Collector)</option>
                  <option value="first_child">First Child (Family Representative)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">{{ t('admins.assignBranch') }} *</label>
                <select v-model="form.branch_id" class="form-control" required>
                  <option value="">{{ t('admins.selectBranch') }}</option>
                  <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
                </select>
              </div>

              <!-- mini_admin_id: only shown for first_child -->
              <div v-if="form.role === 'first_child'" class="form-group">
                <label class="form-label">Assign to Mini-Admin</label>
                <select v-model="form.mini_admin_id" class="form-control">
                  <option :value="null">— None / Unassigned —</option>
                  <option v-for="ma in miniAdmins" :key="ma.id" :value="ma.id">{{ ma.full_name }} ({{ ma.phone }})</option>
                </select>
                <div class="form-hint">The first child will submit collected cash to this mini-admin.</div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-ghost" @click="showModal = false">{{ t('common.cancel') }}</button>
              <button type="submit" class="btn btn-primary" :disabled="saving">
                <span v-if="saving" class="spinner spinner-sm"></span>
                {{ t('common.save') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete confirm -->
    <Teleport to="body">
      <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
        <div class="modal" style="max-width:380px;">
          <div class="modal-body" style="text-align:center;padding:2rem;">
            <div style="font-size:2.5rem;margin-bottom:1rem;">⚠️</div>
            <h3>{{ t('common.deleteConfirm') }}</h3>
            <p class="text-muted mt-1">{{ deleteTarget?.full_name }}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="deleteTarget = null">{{ t('common.cancel') }}</button>
            <button class="btn btn-danger" @click="deleteAdmin" :disabled="saving">
              <span v-if="saving" class="spinner spinner-sm"></span>
              {{ t('common.delete') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../../api/axios'

const { t } = useI18n()

const ROLE_TABS = [
  { value: '', label: 'All Staff' },
  { value: 'admin', label: '🏛️ Admins' },
  { value: 'mini_admin', label: '📦 Mini-Admins' },
  { value: 'first_child', label: '👨‍👩‍👧‍👦 First Children' },
]

const admins = ref([])
const branches = ref([])
const miniAdmins = ref([])
const loading = ref(false)
const saving = ref(false)
const showModal = ref(false)
const editing = ref(null)
const deleteTarget = ref(null)
const formError = ref('')
const roleFilter = ref('')
const pagination = ref({ total: 0 })

const form = ref({
  full_name: '',
  phone: '',
  password: '',
  role: 'admin',
  branch_id: '',
  mini_admin_id: null,
})

function roleLabel(role) {
  if (role === 'admin') return 'Admin'
  if (role === 'mini_admin') return 'Mini-Admin'
  if (role === 'first_child') return 'First Child'
  return role
}

function roleClass(role) {
  if (role === 'admin') return 'badge-danger'
  if (role === 'mini_admin') return 'badge-info'
  if (role === 'first_child') return 'badge-gold'
  return 'badge-warning'
}

function openModal(admin = null) {
  editing.value = admin
  formError.value = ''
  if (admin) {
    form.value = {
      full_name: admin.full_name,
      phone: admin.phone,
      password: '',
      role: admin.role,
      branch_id: admin.branch_id,
      mini_admin_id: admin.mini_admin_id || null,
    }
  } else {
    form.value = { full_name: '', phone: '', password: '', role: 'admin', branch_id: '', mini_admin_id: null }
  }
  showModal.value = true
}

function confirmDelete(admin) { deleteTarget.value = admin }

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

async function fetchAdmins() {
  loading.value = true
  try {
    const params = {}
    if (roleFilter.value) params.role = roleFilter.value
    const res = await api.get('/api/branch-admins', { params })
    admins.value = res.data
    pagination.value.total = res.data.length
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

async function fetchBranches() {
  try {
    const res = await api.get('/api/branches')
    branches.value = res.data
  } catch (e) { console.error(e) }
}

async function fetchMiniAdmins() {
  try {
    const res = await api.get('/api/branch-admins', { params: { role: 'mini_admin' } })
    miniAdmins.value = res.data
  } catch (e) { console.error(e) }
}

async function saveAdmin() {
  formError.value = ''
  saving.value = true
  try {
    const payload = { ...form.value }
    if (!payload.password) delete payload.password
    if (payload.role !== 'first_child') delete payload.mini_admin_id

    if (editing.value) {
      await api.put(`/api/branch-admins/${editing.value.id}`, payload)
    } else {
      await api.post('/api/branch-admins', payload)
    }
    showModal.value = false
    fetchAdmins()
  } catch (e) {
    formError.value = e.response?.data?.error || t('common.error')
  } finally {
    saving.value = false
  }
}

async function deleteAdmin() {
  saving.value = true
  try {
    await api.delete(`/api/branch-admins/${deleteTarget.value.id}`)
    deleteTarget.value = null
    fetchAdmins()
  } catch (e) { console.error(e) }
  finally { saving.value = false }
}

onMounted(() => { fetchAdmins(); fetchBranches(); fetchMiniAdmins() })
</script>

<style scoped>
.role-tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.role-tab-btn {
  padding: 0.4rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 20px;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.role-tab-btn:hover {
  border-color: var(--gold);
  color: var(--gold);
}

.role-tab-btn.active {
  background: rgba(212,175,55,0.15);
  border-color: var(--gold);
  color: var(--gold);
}

.form-hint {
  font-size: 0.77rem;
  color: var(--text-muted);
  margin-top: 0.3rem;
}

.mb-3 { margin-bottom: 1.25rem; }
</style>
