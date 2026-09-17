<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('members.title') }}</h1>
        <p class="page-subtitle">{{ pagination.total }} {{ t('common.total').toLowerCase() }}</p>
      </div>
      <button class="btn btn-primary" @click="openModal()">
        ＋ {{ t('members.addMember') }}
      </button>
    </div>

    <div class="page-content">
      <!-- Filters toolbar -->
      <div class="toolbar mb-2">
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input
            v-model="search"
            type="text"
            :placeholder="t('common.search')"
            @input="debouncedFetch"
          />
        </div>
        <select v-model="statusFilter" class="form-control" style="width:auto;" @change="fetchMembers(1)">
          <option value="active">Active Members</option>
          <option value="deactivated">Deactivated Members</option>
          <option value="all">All Members</option>
        </select>
        <select v-model="paidFilter" class="form-control" style="width:auto;" @change="fetchMembers(1)">
          <option value="">{{ t('members.filterAll') }}</option>
          <option value="true">{{ t('members.filterPaid') }}</option>
          <option value="false">{{ t('members.filterUnpaid') }}</option>
        </select>
      </div>

      <div class="card">
        <div class="card-body" style="padding:0;">
          <div v-if="loading" class="loading-overlay"><div class="spinner"></div></div>
          <div v-else-if="!members.length" class="empty-state">
            <div class="empty-icon">👥</div>
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
                    <th>Consistency Score</th>
                    <th>Payment Status</th>
                    <th>Account Status</th>
                    <th>{{ t('members.joinedOn') }}</th>
                    <th>{{ t('common.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(m, i) in members" :key="m.id" :class="{ 'deactivated-row': !m.is_active }">
                    <td class="text-muted" style="font-size:0.8rem;">{{ (pagination.page - 1) * pagination.limit + i + 1 }}</td>
                    <td>
                      <div style="display:flex;align-items:center;gap:0.75rem;">
                        <img v-if="m.avatar_url" :src="getAvatarUrl(m.avatar_url)" class="member-avatar-img" />
                        <div v-else class="member-avatar">{{ m.full_name.charAt(0) }}</div>
                        <span style="font-weight:600;">{{ m.full_name }}</span>
                      </div>
                    </td>
                    <td class="text-muted">{{ m.phone }}</td>
                    <td>
                      <div class="score-badge-cell">
                        <span class="tier-icon" :title="m.tier">{{ m.tierBadge || '🥈' }}</span>
                        <span class="score-val" :style="{ color: m.tierColor || '#718096' }">{{ m.score || 50 }}/100</span>
                        <span v-if="m.streakMonths > 0" class="streak-mini" title="Active streak">🔥{{ m.streakMonths }}m</span>
                      </div>
                    </td>
                    <td>
                      <span class="badge" :class="m.paid_this_month ? 'badge-success' : 'badge-danger'">
                        {{ m.paid_this_month ? t('members.paidThisMonth') : t('members.unpaidThisMonth') }}
                      </span>
                    </td>
                    <td>
                      <span class="badge" :class="m.is_active ? 'badge-success' : 'badge-danger'">
                        {{ m.is_active ? 'Active' : 'Deactivated' }}
                      </span>
                    </td>
                    <td class="text-muted" style="font-size:0.8rem;">{{ formatDate(m.created_at) }}</td>
                    <td>
                      <div class="flex gap-1" style="flex-wrap:nowrap;">
                        <button class="btn btn-ghost btn-sm" @click="openStatement(m)" title="Annual Statement">📜 Statement</button>

                        <template v-if="m.is_active">
                          <button class="btn btn-ghost btn-sm btn-icon" @click="openModal(m)" title="Edit">✏️</button>
                          <button class="btn btn-danger btn-sm" @click="confirmDeactivate(m)" title="Deactivate Member">🚫 Deactivate</button>
                        </template>

                        <template v-else>
                          <button class="btn btn-success btn-sm" @click="activateMember(m)" title="Reactivate Member">⚡ Activate</button>
                          <button v-if="auth.isSuperAdmin" class="btn btn-danger btn-sm" @click="confirmPermanentDelete(m)" title="Permanent Delete">🗑️ Delete</button>
                        </template>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div class="card-footer flex justify-between items-center">
              <span class="text-muted" style="font-size:0.8rem;">
                {{ t('common.page') }} {{ pagination.page }} {{ t('common.of') }} {{ pagination.pages }}
                ({{ pagination.total }} {{ t('common.total').toLowerCase() }})
              </span>
              <div class="pagination">
                <button class="pagination-btn" :disabled="pagination.page <= 1" @click="fetchMembers(pagination.page - 1)">‹</button>
                <button
                  v-for="p in visiblePages" :key="p"
                  class="pagination-btn" :class="{ active: p === pagination.page }"
                  @click="fetchMembers(p)"
                >{{ p }}</button>
                <button class="pagination-btn" :disabled="pagination.page >= pagination.pages" @click="fetchMembers(pagination.page + 1)">›</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Annual Statement Modal -->
    <AnnualStatementModal
      :show="showStatementModal"
      :member="statementMember"
      :contributions="memberContributions"
      :year="statementYear"
      @close="showStatementModal = false"
      @year-change="handleYearChange"
    />

    <!-- Add/Edit modal -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">{{ editing ? t('members.editMember') : t('members.addMember') }}</span>
            <button class="btn btn-ghost btn-sm btn-icon" @click="showModal = false">✕</button>
          </div>
          <form @submit.prevent="saveMember">
            <div class="modal-body" style="display:flex;flex-direction:column;gap:1rem;">
              <div v-if="formError" class="alert alert-danger">{{ formError }}</div>
              
              <!-- Avatar Upload Field -->
              <div class="form-group" style="text-align:center;margin-bottom:0.5rem;">
                <label class="form-label" style="display:block;margin-bottom:0.5rem;">{{ t('members.profilePicture') }}</label>
                <div style="display:inline-flex;flex-direction:column;align-items:center;gap:0.5rem;">
                  <div class="avatar-preview-container">
                    <img v-if="avatarPreview" :src="avatarPreview" class="avatar-preview-img" />
                    <div v-else class="avatar-preview-placeholder">
                      {{ form.full_name ? form.full_name.charAt(0) : '📷' }}
                    </div>
                  </div>
                  <div style="display:flex;gap:0.5rem;align-items:center;">
                    <label class="btn btn-ghost btn-sm" style="cursor:pointer;margin:0;">
                      📷 {{ t('members.choosePhoto') }}
                      <input type="file" accept="image/*" style="display:none;" @change="handleFileSelect" />
                    </label>
                    <button v-if="avatarPreview" type="button" class="btn btn-danger btn-sm" @click="removeAvatarFile">
                      ✕
                    </button>
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">{{ t('common.name') }} *</label>
                <input v-model="form.full_name" type="text" class="form-control" required />
              </div>
              <div class="form-group">
                <label class="form-label">{{ t('common.phone') }} *</label>
                <input v-model="form.phone" type="tel" class="form-control" required />
              </div>
              <div class="form-group">
                <label class="form-label">{{ editing ? t('admins.newPassword') : t('login.password') + ' *' }}</label>
                <input v-model="form.password" type="password" class="form-control" :required="!editing" />
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

    <!-- Deactivate confirm modal -->
    <Teleport to="body">
      <div v-if="deactivateTarget" class="modal-overlay" @click.self="deactivateTarget = null">
        <div class="modal" style="max-width:400px;">
          <div class="modal-body" style="text-align:center;padding:2rem;">
            <div style="font-size:2.5rem;margin-bottom:1rem;">🚫</div>
            <h3>Deactivate Member?</h3>
            <p class="text-muted mt-1">
              <strong>{{ deactivateTarget?.full_name }}</strong> will be deactivated and will no longer be able to log in. Superadmins can reactivate or permanently delete this account later.
            </p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="deactivateTarget = null">{{ t('common.cancel') }}</button>
            <button class="btn btn-danger" @click="deactivateMember" :disabled="saving">
              <span v-if="saving" class="spinner spinner-sm"></span>
              Deactivate
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Permanent Delete confirm modal (Superadmin) -->
    <Teleport to="body">
      <div v-if="permanentDeleteTarget" class="modal-overlay" @click.self="permanentDeleteTarget = null">
        <div class="modal" style="max-width:400px;">
          <div class="modal-body" style="text-align:center;padding:2rem;">
            <div style="font-size:2.5rem;margin-bottom:1rem;">⚠️</div>
            <h3 style="color:var(--danger);">Permanently Delete Member?</h3>
            <p class="text-muted mt-1">
              This action <strong>CANNOT</strong> be undone. Member <strong>{{ permanentDeleteTarget?.full_name }}</strong> and all associated data will be permanently removed.
            </p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="permanentDeleteTarget = null">{{ t('common.cancel') }}</button>
            <button class="btn btn-danger" @click="permanentDeleteMember" :disabled="saving">
              <span v-if="saving" class="spinner spinner-sm"></span>
              Delete Permanently
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/auth'
import api from '../../api/axios'
import { getAvatarUrl } from '../../utils/avatar'
import AnnualStatementModal from '../../components/AnnualStatementModal.vue'

const { t } = useI18n()
const auth = useAuthStore()
const members = ref([])
const loading = ref(false)
const saving = ref(false)
const showModal = ref(false)
const editing = ref(null)

const deactivateTarget = ref(null)
const permanentDeleteTarget = ref(null)

const formError = ref('')
const search = ref('')
const paidFilter = ref('')
const statusFilter = ref('active')
const pagination = ref({ total: 0, page: 1, limit: 15, pages: 1 })
const form = ref({ full_name: '', phone: '', password: '' })
const avatarFile = ref(null)
const avatarPreview = ref(null)

// Annual Statement Modal state
const showStatementModal = ref(false)
const statementMember = ref(null)
const memberContributions = ref([])
const statementYear = ref(new Date().getFullYear())

async function openStatement(member) {
  statementMember.value = member
  statementYear.value = new Date().getFullYear()
  try {
    const res = await api.get('/api/contributions', {
      params: { member_id: member.id, limit: 100 }
    })
    memberContributions.value = res.data.data
  } catch (err) {
    console.error('Error fetching member contributions for statement:', err)
    memberContributions.value = []
  }
  showStatementModal.value = true
}

function handleYearChange(newYear) {
  statementYear.value = newYear
}

let debounceTimer = null
function debouncedFetch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => fetchMembers(1), 350)
}

const visiblePages = computed(() => {
  const pages = []
  const { page, pages: total } = pagination.value
  const start = Math.max(1, page - 2)
  const end = Math.min(total, page + 2)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

function handleFileSelect(event) {
  const file = event.target.files[0]
  if (!file) return
  avatarFile.value = file
  avatarPreview.value = URL.createObjectURL(file)
}

function removeAvatarFile() {
  avatarFile.value = null
  avatarPreview.value = null
}

function openModal(member = null) {
  editing.value = member
  form.value = member
    ? { full_name: member.full_name, phone: member.phone, password: '' }
    : { full_name: '', phone: '', password: '' }
  avatarFile.value = null
  avatarPreview.value = member?.avatar_url || null
  formError.value = ''
  showModal.value = true
}

function confirmDeactivate(member) { deactivateTarget.value = member }
function confirmPermanentDelete(member) { permanentDeleteTarget.value = member }

function formatDate(d) {
  if (!d) return 'N/A'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

async function fetchMembers(page = 1) {
  loading.value = true
  try {
    const res = await api.get('/api/members', {
      params: {
        page,
        limit: 15,
        search: search.value || undefined,
        paid_this_month: paidFilter.value || undefined,
        status: statusFilter.value
      }
    })
    members.value = res.data.data
    pagination.value = res.data.pagination
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

async function saveMember() {
  formError.value = ''
  saving.value = true
  try {
    const formData = new FormData()
    formData.append('full_name', form.value.full_name)
    formData.append('phone', form.value.phone)
    if (form.value.password) formData.append('password', form.value.password)
    if (avatarFile.value) formData.append('avatar', avatarFile.value)

    const config = { headers: { 'Content-Type': 'multipart/form-data' } }

    if (editing.value) {
      await api.put(`/api/members/${editing.value.id}`, formData, config)
    } else {
      await api.post('/api/members', formData, config)
    }
    showModal.value = false
    fetchMembers()
  } catch (e) {
    formError.value = e.response?.data?.error || t('common.error')
  } finally {
    saving.value = false
  }
}

async function deactivateMember() {
  if (!deactivateTarget.value) return
  saving.value = true
  try {
    await api.delete(`/api/members/${deactivateTarget.value.id}`)
    deactivateTarget.value = null
    fetchMembers()
  } catch (e) { console.error(e) }
  finally { saving.value = false }
}

async function activateMember(member) {
  saving.value = true
  try {
    await api.put(`/api/members/${member.id}/activate`)
    fetchMembers()
  } catch (e) { console.error(e) }
  finally { saving.value = false }
}

async function permanentDeleteMember() {
  if (!permanentDeleteTarget.value) return
  saving.value = true
  try {
    await api.delete(`/api/members/${permanentDeleteTarget.value.id}/permanent`)
    permanentDeleteTarget.value = null
    fetchMembers()
  } catch (e) { console.error(e) }
  finally { saving.value = false }
}

onMounted(() => fetchMembers())
</script>


<style scoped>
.member-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(212,175,55,0.15), rgba(139,26,26,0.15));
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--gold);
  flex-shrink: 0;
}

.member-avatar-img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid var(--gold);
  flex-shrink: 0;
}

.avatar-preview-container {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 2px dashed var(--gold);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: rgba(212,175,55,0.05);
}

.avatar-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-preview-placeholder {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gold);
}

.score-badge-cell {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
}

.tier-icon {
  font-size: 1.1rem;
}

.score-val {
  font-weight: 700;
  font-family: monospace;
}

.streak-mini {
  background: rgba(237, 137, 54, 0.15);
  color: #dd6b20;
  padding: 0.15rem 0.4rem;
  border-radius: 12px;
  font-weight: 800;
  font-size: 0.72rem;
}

@media (max-width: 600px) {
  .card-footer {
    flex-direction: column;
    gap: 0.75rem;
    align-items: center;
  }
}
</style>

