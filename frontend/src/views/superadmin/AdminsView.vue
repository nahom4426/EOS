<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('admins.title') }}</h1>
        <p class="page-subtitle">{{ pagination.total }} {{ t('common.total').toLowerCase() }}</p>
      </div>
      <button class="btn btn-primary" @click="openModal()">
        ＋ {{ t('admins.addAdmin') }}
      </button>
    </div>

    <div class="page-content">
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
                    <th>{{ t('common.branch') }}</th>
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
                      <span class="badge badge-gold">{{ a.branch_name || '—' }}</span>
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

    <!-- Modal -->
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
                <label class="form-label">{{ t('admins.assignBranch') }} *</label>
                <select v-model="form.branch_id" class="form-control" required>
                  <option value="">{{ t('admins.selectBranch') }}</option>
                  <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
                </select>
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
const admins = ref([])
const branches = ref([])
const loading = ref(false)
const saving = ref(false)
const showModal = ref(false)
const editing = ref(null)
const deleteTarget = ref(null)
const formError = ref('')
const pagination = ref({ total: 0 })

const form = ref({ full_name: '', phone: '', password: '', branch_id: '' })

function openModal(admin = null) {
  editing.value = admin
  form.value = admin
    ? { full_name: admin.full_name, phone: admin.phone, password: '', branch_id: admin.branch_id }
    : { full_name: '', phone: '', password: '', branch_id: '' }
  formError.value = ''
  showModal.value = true
}

function confirmDelete(admin) { deleteTarget.value = admin }

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

async function fetchAdmins() {
  loading.value = true
  try {
    const res = await api.get('/api/branch-admins')
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

async function saveAdmin() {
  formError.value = ''
  saving.value = true
  try {
    const payload = { ...form.value }
    if (!payload.password) delete payload.password
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

onMounted(() => { fetchAdmins(); fetchBranches() })
</script>
