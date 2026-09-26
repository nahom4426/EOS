<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('contributions.title') }}</h1>
        <p class="page-subtitle">{{ t('contributions.history') }}</p>
      </div>
      <button class="btn btn-primary" @click="showLogModal = true">
        ＋ {{ t('contributions.logContribution') }}
      </button>
    </div>

    <div class="page-content">
      <!-- Filters toolbar -->
      <div class="toolbar mb-2" style="flex-wrap:wrap;gap:0.5rem;">
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input v-model="memberSearch" type="text" :placeholder="t('common.search')" @input="debouncedFetch" />
        </div>
        <select v-model="statusFilter" class="form-control" style="width:auto;" @change="fetchContributions(1)">
          <option value="">All Statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="RECEIVED_BY_MINI_ADMIN">Received by Mini-Admin</option>
          <option value="SETTLED_WITH_ADMIN">Settled</option>
        </select>
        <select v-model="miniAdminFilter" class="form-control" style="width:auto;" @change="fetchContributions(1)">
          <option value="">All Mini-Admins</option>
          <option v-for="ma in miniAdmins" :key="ma.id" :value="ma.id">{{ ma.full_name }}</option>
        </select>
        <input type="date" class="form-control" v-model="dateFrom" @change="fetchContributions(1)" style="width:auto;" placeholder="From" />
        <input type="date" class="form-control" v-model="dateTo" @change="fetchContributions(1)" style="width:auto;" placeholder="To" />
        <input type="month" class="form-control" v-model="monthFilter" @change="fetchContributions(1)" style="width:auto;" />
        <button v-if="hasFilters" class="btn btn-ghost btn-sm" @click="clearFilters">Clear</button>
      </div>

      <!-- Bulk action bar (shown when rows selected) -->
      <div v-if="selectedIds.length" class="bulk-bar mb-2">
        <span class="text-muted" style="font-size:0.875rem;">
          {{ selectedIds.length }} selected
        </span>
        <button class="btn btn-primary btn-sm" :disabled="approving" @click="bulkApprove">
          <span v-if="approving" class="spinner spinner-sm"></span>
          ✅ Approve Selected
        </button>
        <div v-if="approveMsg" class="badge" :class="approveMsgOk ? 'badge-success' : 'badge-danger'">
          {{ approveMsg }}
        </div>
      </div>

      <div class="card">
        <div class="card-body" style="padding:0;">
          <div v-if="loading" class="loading-overlay"><div class="spinner"></div></div>
          <div v-else-if="!contributions.length" class="empty-state">
            <div class="empty-icon">💰</div>
            <div class="empty-text">{{ t('common.noData') }}</div>
          </div>
          <div v-else>
            <div class="table-wrapper" style="border:none;border-radius:0;">
              <table class="table">
                <thead>
                  <tr>
                    <th style="width:36px;">
                      <input type="checkbox" :checked="allPageSelected" @change="toggleSelectAll" />
                    </th>
                    <th>{{ t('common.name') }}</th>
                    <th>{{ t('common.phone') }}</th>
                    <th>Months Covered</th>
                    <th>{{ t('common.amount') }}</th>
                    <th>Status</th>
                    <th>Mini-Admin</th>
                    <th>{{ t('contributions.datePaid') }}</th>
                    <th>{{ t('contributions.recordedBy') }}</th>
                    <th>{{ t('common.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in contributions" :key="c.id">
                    <td>
                      <input
                        type="checkbox"
                        :value="c.id"
                        v-model="selectedIds"
                        :disabled="c.status === 'SETTLED_WITH_ADMIN'"
                      />
                    </td>
                    <td><span style="font-weight:600;">{{ c.member_name }}</span></td>
                    <td class="text-muted">{{ c.member_phone }}</td>
                    <td>
                      <span v-if="c.months_covered?.length" class="months-pills">
                        <span
                          v-for="m in c.months_covered"
                          :key="m"
                          class="badge badge-gold month-pill"
                        >{{ m }}</span>
                      </span>
                      <span v-else class="badge badge-gold">{{ formatMonthLabel(c.month_covered) }}</span>
                    </td>
                    <td><span style="font-weight:700;color:var(--gold);">{{ formatCurrency(c.amount) }}</span></td>
                    <td>
                      <span class="badge" :class="statusClass(c.status)">{{ statusLabel(c.status) }}</span>
                    </td>
                    <td class="text-muted" style="font-size:0.8rem;">{{ c.mini_admin_name || '—' }}</td>
                    <td class="text-muted" style="font-size:0.8rem;">{{ formatDate(c.date_paid) }}</td>
                    <td class="text-muted" style="font-size:0.8rem;">{{ c.recorded_by_name }}</td>
                    <td>
                      <div class="flex gap-1">
                        <button class="btn btn-ghost btn-sm" @click="openReceipt(c)" title="Print Receipt">🧾 Receipt</button>
                        <button class="btn btn-danger btn-sm btn-icon" @click="confirmDelete(c)" title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="card-footer flex justify-between items-center">
              <span class="text-muted" style="font-size:0.8rem;">
                {{ t('common.page') }} {{ pagination.page }} {{ t('common.of') }} {{ pagination.pages }}
              </span>
              <div class="pagination">
                <button class="pagination-btn" :disabled="pagination.page <= 1" @click="fetchContributions(pagination.page - 1)">‹</button>
                <button v-for="p in visiblePages" :key="p" class="pagination-btn" :class="{ active: p === pagination.page }" @click="fetchContributions(p)">{{ p }}</button>
                <button class="pagination-btn" :disabled="pagination.page >= pagination.pages" @click="fetchContributions(pagination.page + 1)">›</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Receipt Modal -->
    <ReceiptModal :show="showReceiptModal" :contribution="selectedReceipt" @close="showReceiptModal = false" />

    <!-- Log Contribution Modal -->
    <Teleport to="body">
      <div v-if="showLogModal" class="modal-overlay" @click.self="showLogModal = false">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">{{ t('contributions.logContribution') }}</span>
            <button class="btn btn-ghost btn-sm btn-icon" @click="showLogModal = false">✕</button>
          </div>
          <form @submit.prevent="logContribution">
            <div class="modal-body" style="display:flex;flex-direction:column;gap:1rem;">
              <div v-if="formError" class="alert alert-danger">{{ formError }}</div>
              <div v-if="formSuccess" class="alert alert-success">✅ {{ t('common.success') }}</div>

              <div class="form-group">
                <label class="form-label">{{ t('contributions.selectMember') }} *</label>
                <div style="position:relative;">
                  <input v-model="memberSearchInput" type="text" class="form-control" :placeholder="t('common.search')" @input="searchMembers" @focus="showMemberDropdown = true" />
                  <div v-if="showMemberDropdown && memberSuggestions.length" class="member-dropdown">
                    <div v-for="m in memberSuggestions" :key="m.id" class="member-suggestion" @click="selectMember(m)">
                      <span style="font-weight:600;">{{ m.full_name }}</span>
                      <span class="text-muted" style="font-size:0.8rem;">{{ m.phone }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="logForm.member_id" class="badge badge-success mt-1">✓ {{ selectedMemberName }}</div>
              </div>

              <div class="form-group">
                <label class="form-label">Category / ዓይነት *</label>
                <select v-model="logForm.category" class="form-control" required>
                  <option value="Monthly Dues">Monthly Dues</option>
                  <option value="Tithe / Asrat">Tithe / Asrat (ዐሥራት)</option>
                  <option value="Building Fund">Building Fund (ሕንፃ መሥሪያ)</option>
                  <option value="Special Offering / Sebit">Special Offering / Sebit</option>
                  <option value="Sunday School">Sunday School (ሰንበት ትምህርት ቤት)</option>
                  <option value="Charity / Edir">Charity / Edir</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">{{ t('common.amount') }} (ETB) *</label>
                <input v-model="logForm.amount" type="number" step="0.01" min="0.01" class="form-control" required :placeholder="t('contributions.enterAmount')" />
              </div>

              <div class="form-group">
                <label class="form-label">{{ t('contributions.monthCovered') }} *</label>
                <input v-model="logForm.month_covered" type="month" class="form-control" required />
              </div>

              <div class="form-group">
                <label class="form-label">{{ t('contributions.datePaid') }}</label>
                <input v-model="logForm.date_paid" type="date" class="form-control" />
              </div>

              <div class="form-group">
                <label class="form-label">{{ t('common.note') }}</label>
                <textarea v-model="logForm.note" class="form-control" rows="2" style="resize:vertical;"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-ghost" @click="showLogModal = false">{{ t('common.cancel') }}</button>
              <button type="submit" class="btn btn-primary" :disabled="saving || !logForm.member_id">
                <span v-if="saving" class="spinner spinner-sm"></span>
                {{ t('contributions.logContribution') }}
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
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="deleteTarget = null">{{ t('common.cancel') }}</button>
            <button class="btn btn-danger" @click="deleteContribution" :disabled="saving">
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
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../../api/axios'
import ReceiptModal from '../../components/ReceiptModal.vue'

const { t } = useI18n()
const contributions = ref([])
const loading = ref(false)
const saving = ref(false)
const approving = ref(false)
const showLogModal = ref(false)
const deleteTarget = ref(null)
const formError = ref('')
const formSuccess = ref(false)
const memberSearch = ref('')
const monthFilter = ref('')
const statusFilter = ref('')
const miniAdminFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const miniAdmins = ref([])
const pagination = ref({ total: 0, page: 1, limit: 15, pages: 1 })

const selectedIds = ref([])
const approveMsg = ref('')
const approveMsgOk = ref(true)

const showReceiptModal = ref(false)
const selectedReceipt = ref(null)

const memberSearchInput = ref('')
const memberSuggestions = ref([])
const showMemberDropdown = ref(false)
const selectedMemberName = ref('')

const logForm = ref({
  member_id: null,
  category: 'Monthly Dues',
  amount: '',
  month_covered: new Date().toISOString().slice(0, 7),
  date_paid: new Date().toISOString().split('T')[0],
  note: '',
})

const hasFilters = computed(() =>
  monthFilter.value || statusFilter.value || miniAdminFilter.value || dateFrom.value || dateTo.value
)

const allPageSelected = computed(() =>
  contributions.value.length > 0 &&
  contributions.value
    .filter(c => c.status !== 'SETTLED_WITH_ADMIN')
    .every(c => selectedIds.value.includes(c.id))
)

function toggleSelectAll() {
  if (allPageSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = contributions.value
      .filter(c => c.status !== 'SETTLED_WITH_ADMIN')
      .map(c => c.id)
  }
}

function openReceipt(c) {
  selectedReceipt.value = c
  showReceiptModal.value = true
}

function clearFilters() {
  monthFilter.value = ''
  statusFilter.value = ''
  miniAdminFilter.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  fetchContributions(1)
}

function statusLabel(s) {
  if (s === 'SUBMITTED') return 'Submitted'
  if (s === 'RECEIVED_BY_MINI_ADMIN') return 'With Mini-Admin'
  if (s === 'SETTLED_WITH_ADMIN') return 'Settled ✓'
  return s
}

function statusClass(s) {
  if (s === 'SETTLED_WITH_ADMIN') return 'badge-success'
  if (s === 'RECEIVED_BY_MINI_ADMIN') return 'badge-info'
  return 'badge-warning'
}

let debounceTimer = null
function debouncedFetch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => fetchContributions(1), 350)
}

let memberDebounce = null
function searchMembers() {
  clearTimeout(memberDebounce)
  memberDebounce = setTimeout(async () => {
    if (!memberSearchInput.value.trim()) { memberSuggestions.value = []; return }
    try {
      const res = await api.get('/api/members', { params: { search: memberSearchInput.value, limit: 10 } })
      memberSuggestions.value = res.data.data
    } catch (e) { console.error(e) }
  }, 250)
}

function selectMember(m) {
  logForm.value.member_id = m.id
  selectedMemberName.value = m.full_name
  memberSearchInput.value = m.full_name
  showMemberDropdown.value = false
  memberSuggestions.value = []
}

function confirmDelete(c) { deleteTarget.value = c }

const visiblePages = computed(() => {
  const pages = []
  const { page, pages: total } = pagination.value
  const start = Math.max(1, page - 2)
  const end = Math.min(total, page + 2)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

function formatCurrency(val) {
  return new Intl.NumberFormat('en-ET', { minimumFractionDigits: 2 }).format(val) + ' ETB'
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatMonthLabel(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

async function fetchContributions(page = 1) {
  loading.value = true
  selectedIds.value = []
  try {
    const params = { page, limit: 15 }
    if (monthFilter.value) params.month = monthFilter.value
    if (statusFilter.value) params.status = statusFilter.value
    if (miniAdminFilter.value) params.mini_admin_id = miniAdminFilter.value
    if (dateFrom.value) params.date_from = dateFrom.value
    if (dateTo.value) params.date_to = dateTo.value
    const res = await api.get('/api/contributions', { params })
    contributions.value = res.data.data
    pagination.value = res.data.pagination
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

async function fetchMiniAdmins() {
  try {
    const res = await api.get('/api/members/mini-admins')
    miniAdmins.value = res.data
  } catch (e) { console.error(e) }
}

async function bulkApprove() {
  approveMsg.value = ''
  approving.value = true
  try {
    const res = await api.patch('/api/contributions/admin/bulk-approve', {
      contribution_ids: selectedIds.value
    })
    approveMsg.value = res.data.message
    approveMsgOk.value = true
    selectedIds.value = []
    fetchContributions(pagination.value.page)
  } catch (e) {
    approveMsg.value = e.response?.data?.error || 'Approval failed'
    approveMsgOk.value = false
  } finally {
    approving.value = false
  }
}

async function logContribution() {
  formError.value = ''
  formSuccess.value = false
  saving.value = true
  try {
    const payload = {
      ...logForm.value,
      month_covered: logForm.value.month_covered + '-01',
      amount: parseFloat(logForm.value.amount),
    }
    await api.post('/api/contributions', payload)
    formSuccess.value = true
    logForm.value = {
      member_id: null, category: 'Monthly Dues', amount: '',
      month_covered: new Date().toISOString().slice(0, 7),
      date_paid: new Date().toISOString().split('T')[0], note: '',
    }
    memberSearchInput.value = ''
    selectedMemberName.value = ''
    fetchContributions()
    setTimeout(() => { formSuccess.value = false; showLogModal.value = false }, 1500)
  } catch (e) {
    formError.value = e.response?.data?.error || t('common.error')
  } finally {
    saving.value = false
  }
}

async function deleteContribution() {
  saving.value = true
  try {
    await api.delete(`/api/contributions/${deleteTarget.value.id}`)
    deleteTarget.value = null
    fetchContributions()
  } catch (e) { console.error(e) }
  finally { saving.value = false }
}

onMounted(() => { fetchContributions(); fetchMiniAdmins() })
</script>

<style scoped>
.bulk-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.6rem 1rem;
  flex-wrap: wrap;
}

.months-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}

.month-pill {
  font-size: 0.68rem;
  padding: 0.1rem 0.4rem;
}

.member-dropdown {
  position: absolute;
  top: 100%; left: 0; right: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-top: none;
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: var(--shadow-md);
}

.member-suggestion {
  padding: 0.65rem 1rem;
  display: flex;
  justify-content: space-between;
  cursor: pointer;
  transition: background 0.15s;
  font-size: 0.875rem;
}

.member-suggestion:hover { background: var(--bg-glass-hover); }

@media (max-width: 600px) {
  .card-footer { flex-direction: column; gap: 0.75rem; align-items: center; }
}
</style>
