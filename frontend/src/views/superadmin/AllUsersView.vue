<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ lang === 'en' ? 'All System Users' : 'ሁሉንም የስርዓት ተጠቃሚዎች' }}</h1>
        <p class="page-subtitle">{{ pagination.total }} {{ lang === 'en' ? 'total registered accounts' : 'አጠቃላይ ተጠቃሚዎች' }}</p>
      </div>
    </div>

    <div class="page-content">
      <!-- Filters toolbar -->
      <div class="toolbar mb-2">
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input
            v-model="search"
            type="text"
            :placeholder="lang === 'en' ? 'Search by name or phone...' : 'በስም ወይም በስልክ ይፈልጉ...'"
            @input="debouncedFetch"
          />
        </div>

        <select v-model="statusFilter" class="form-control" style="width:auto;" @change="fetchUsers()">
          <option value="all">All Statuses</option>
          <option value="active">Active Users</option>
          <option value="deactivated">Deactivated Users</option>
        </select>

        <select v-model="roleFilter" class="form-control" style="width:auto;" @change="fetchUsers()">
          <option value="">{{ lang === 'en' ? 'All Roles' : 'ሁሉንም ሚናዎች' }}</option>
          <option value="superadmin">👑 Superadmin</option>
          <option value="branch_admin">🏛️ Branch Admin</option>
          <option value="member">👤 Member</option>
        </select>

        <select v-model="branchFilter" class="form-control" style="width:auto;" @change="fetchUsers()">
          <option value="">{{ lang === 'en' ? 'All Branches' : 'ሁሉንም ቅርንጫፎች' }}</option>
          <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
      </div>

      <!-- Users Table Card -->
      <div class="card">
        <div class="card-body" style="padding:0;">
          <div v-if="loading" class="loading-overlay"><div class="spinner"></div></div>
          <div v-else-if="!users.length" class="empty-state">
            <div class="empty-icon">👥</div>
            <div class="empty-text">{{ lang === 'en' ? 'No users found' : 'ምንም ተጠቃሚ አልተገኘም' }}</div>
          </div>
          <div v-else>
            <div class="table-wrapper" style="border:none;border-radius:0;">
              <table class="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{{ lang === 'en' ? 'User' : 'ተጠቃሚ' }}</th>
                    <th>{{ lang === 'en' ? 'Phone' : 'ስልክ' }}</th>
                    <th>{{ lang === 'en' ? 'Role' : 'ሚና' }}</th>
                    <th>Status</th>
                    <th>{{ lang === 'en' ? 'Branch' : 'ቅርንጫፍ' }}</th>
                    <th>{{ lang === 'en' ? 'Joined On' : 'የተመዘገቡበት ቀን' }}</th>
                    <th>{{ lang === 'en' ? 'Actions' : 'ድርጊቶች' }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(u, i) in users" :key="u.id" :class="{ 'deactivated-row': u.is_active === false }">
                    <td class="text-muted" style="font-size:0.8rem;">
                      {{ (pagination.page - 1) * pagination.limit + i + 1 }}
                    </td>
                    <td>
                      <div style="display:flex;align-items:center;gap:0.75rem;">
                        <img v-if="u.avatar_url" :src="getAvatarUrl(u.avatar_url)" class="user-avatar-img" />
                        <div v-else class="user-avatar" :class="getRoleAvatarClass(u.role)">
                          {{ u.full_name?.charAt(0) || '👤' }}
                        </div>
                        <div>
                          <div style="font-weight:600;">{{ u.full_name }}</div>
                          <div v-if="u.id === auth.user?.id" style="font-size:0.75rem;color:var(--gold);">(You)</div>
                        </div>
                      </div>
                    </td>
                    <td style="font-family:monospace;font-weight:600;">{{ u.phone }}</td>
                    <td>
                      <span :class="getRoleBadgeClass(u.role)">
                        {{ getRoleLabel(u.role) }}
                      </span>
                    </td>
                    <td>
                      <span class="badge" :class="u.is_active !== false ? 'badge-success' : 'badge-danger'">
                        {{ u.is_active !== false ? 'Active' : 'Deactivated' }}
                      </span>
                    </td>
                    <td>
                      <span v-if="u.branch_name" class="badge badge-gold">{{ u.branch_name }}</span>
                      <span v-else class="text-muted">—</span>
                    </td>
                    <td class="text-muted" style="font-size:0.85rem;">{{ formatDate(u.created_at) }}</td>
                    <td>
                      <div class="flex gap-1" style="flex-wrap:nowrap;">
                        <button class="btn btn-ghost btn-sm" @click="editUser(u)">✏️ Edit</button>
                        <button v-if="u.is_active === false" class="btn btn-success btn-sm" @click="confirmActivate(u)">⚡ Activate</button>
                        <button v-else-if="u.id !== auth.user?.id" class="btn btn-danger btn-sm" @click="confirmDeactivate(u)">🚫 Deactivate</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div class="pagination" v-if="pagination.totalPages > 1">
              <button
                class="pagination-btn"
                :disabled="pagination.page <= 1"
                @click="changePage(pagination.page - 1)"
              >
                ‹ Previous
              </button>
              <span class="pagination-info">
                Page {{ pagination.page }} of {{ pagination.totalPages }}
              </span>
              <button
                class="pagination-btn"
                :disabled="pagination.page >= pagination.totalPages"
                @click="changePage(pagination.page + 1)"
              >
                Next ›
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit User Modal -->
    <div class="modal-backdrop" v-if="showModal">
      <div class="modal card">
        <div class="modal-header">
          <h3>✏️ {{ lang === 'en' ? 'Edit User Details' : 'የተጠቃሚ መረጃ አስተካክል' }}</h3>
          <button class="modal-close" @click="closeModal">✕</button>
        </div>
        <form @submit.prevent="saveUser">
          <div class="form-group mb-2">
            <label class="form-label">{{ lang === 'en' ? 'Full Name' : 'ሙሉ ስም' }}</label>
            <input v-model="editForm.full_name" type="text" class="form-control" required />
          </div>
          <div class="form-group mb-2">
            <label class="form-label">{{ lang === 'en' ? 'Phone Number' : 'ስልክ ቁጥር' }}</label>
            <input v-model="editForm.phone" type="tel" class="form-control" required />
          </div>
          <div class="form-group mb-2" v-if="editForm.role !== 'superadmin'">
            <label class="form-label">{{ lang === 'en' ? 'Branch' : 'ቅርንጫፍ' }}</label>
            <select v-model="editForm.branch_id" class="form-control" required>
              <option value="">Select Branch</option>
              <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </div>
          <div v-if="formError" class="alert alert-error mb-2">{{ formError }}</div>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" @click="closeModal">{{ lang === 'en' ? 'Cancel' : 'ሰርዝ' }}</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <span v-if="saving" class="spinner-sm"></span>
              <span v-else>💾 {{ lang === 'en' ? 'Save Changes' : 'መዝግብ' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Deactivate Confirmation Modal -->
    <Teleport to="body">
      <div v-if="deactivateTarget" class="modal-overlay" @click.self="deactivateTarget = null">
        <div class="modal" style="max-width:400px;">
          <div class="modal-body" style="text-align:center;padding:2rem;">
            <div style="font-size:2.5rem;margin-bottom:1rem;">🚫</div>
            <h3>Deactivate User Account?</h3>
            <p class="text-muted mt-1">
              Are you sure you want to deactivate <strong>{{ deactivateTarget?.full_name }}</strong>? They will not be able to log in until reactivated.
            </p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="deactivateTarget = null">Cancel</button>
            <button class="btn btn-danger" @click="performDeactivate" :disabled="saving">
              <span v-if="saving" class="spinner spinner-sm"></span>
              Deactivate User
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Activate Confirmation Modal -->
    <Teleport to="body">
      <div v-if="activateTarget" class="modal-overlay" @click.self="activateTarget = null">
        <div class="modal" style="max-width:400px;">
          <div class="modal-body" style="text-align:center;padding:2rem;">
            <div style="font-size:2.5rem;margin-bottom:1rem;">⚡</div>
            <h3>Reactivate User Account?</h3>
            <p class="text-muted mt-1">
              Reactivate account for <strong>{{ activateTarget?.full_name }}</strong>? They will regain access to log in.
            </p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="activateTarget = null">Cancel</button>
            <button class="btn btn-success" @click="performActivate" :disabled="saving">
              <span v-if="saving" class="spinner spinner-sm"></span>
              Activate User
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useLangStore } from '../../stores/lang'
import { getAvatarUrl } from '../../utils/avatar'
import api from '../../api/axios'

const auth = useAuthStore()
const langStore = useLangStore()
const lang = computed(() => langStore.lang)

const loading = ref(false)
const users = ref([])
const branches = ref([])
const search = ref('')
const roleFilter = ref('')
const branchFilter = ref('')
const statusFilter = ref('all')

const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })

const showModal = ref(false)
const deactivateTarget = ref(null)
const activateTarget = ref(null)
const saving = ref(false)
const formError = ref('')
const editForm = ref({ id: null, full_name: '', phone: '', role: '', branch_id: '' })

let timer = null
function debouncedFetch() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    pagination.value.page = 1
    fetchUsers()
  }, 300)
}

function formatDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString(lang.value === 'am' ? 'am-ET' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

function getRoleLabel(role) {
  if (role === 'superadmin') return '👑 Superadmin'
  if (role === 'branch_admin') return '🏛️ Branch Admin'
  return '👤 Member'
}

function getRoleBadgeClass(role) {
  if (role === 'superadmin') return 'badge badge-gold'
  if (role === 'branch_admin') return 'badge badge-purple'
  return 'badge badge-success'
}

function getRoleAvatarClass(role) {
  if (role === 'superadmin') return 'avatar-gold'
  if (role === 'branch_admin') return 'avatar-purple'
  return 'avatar-green'
}

async function fetchBranches() {
  try {
    const res = await api.get('/api/branches')
    branches.value = res.data
  } catch (e) {
    console.error(e)
  }
}

async function fetchUsers() {
  loading.value = true
  try {
    const params = {
      page: pagination.value.page,
      limit: pagination.value.limit,
      status: statusFilter.value
    }
    if (search.value) params.search = search.value
    if (roleFilter.value) params.role = roleFilter.value
    if (branchFilter.value) params.branch_id = branchFilter.value

    const res = await api.get('/api/branch-admins/all-users', { params })
    users.value = res.data.users
    pagination.value = res.data.pagination
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function confirmActivate(u) { activateTarget.value = u }
function confirmDeactivate(u) { deactivateTarget.value = u }

async function performActivate() {
  if (!activateTarget.value) return
  saving.value = true
  try {
    await api.put(`/api/members/${activateTarget.value.id}/activate`)
    activateTarget.value = null
    fetchUsers()
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}

async function performDeactivate() {
  if (!deactivateTarget.value) return
  saving.value = true
  try {
    await api.delete(`/api/members/${deactivateTarget.value.id}`)
    deactivateTarget.value = null
    fetchUsers()
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}


function changePage(p) {
  pagination.value.page = p
  fetchUsers()
}

function editUser(u) {
  editForm.value = {
    id: u.id,
    full_name: u.full_name,
    phone: u.phone,
    role: u.role,
    branch_id: u.branch_id || '',
  }
  formError.value = ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

async function saveUser() {
  saving.value = true
  formError.value = ''
  try {
    if (editForm.value.role === 'branch_admin') {
      await api.put(`/api/branch-admins/${editForm.value.id}`, editForm.value)
    } else if (editForm.value.role === 'member') {
      await api.put(`/api/members/${editForm.value.id}`, editForm.value)
    }
    showModal.value = false
    fetchUsers()
  } catch (err) {
    formError.value = err.response?.data?.error || 'Failed to update user'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchBranches()
  fetchUsers()
})
</script>

<style scoped>
.user-avatar-img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--gold);
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
}

.avatar-gold {
  background: rgba(212, 175, 55, 0.2);
  color: var(--gold);
  border: 1px solid var(--gold);
}

.avatar-purple {
  background: rgba(147, 51, 234, 0.2);
  color: #c084fc;
  border: 1px solid #c084fc;
}

.avatar-green {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  border: 1px solid #4ade80;
}

.badge-purple {
  background: rgba(147, 51, 234, 0.2);
  color: #c084fc;
  border: 1px solid rgba(147, 51, 234, 0.3);
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 1rem;
}

.modal {
  width: 100%;
  max-width: 480px;
  padding: 1.5rem;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.modal-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.2rem;
  cursor: pointer;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

@media (max-width: 600px) {
  .pagination {
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
  }
}
</style>
