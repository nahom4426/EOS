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
      <!-- Filters -->
      <div class="toolbar mb-2">
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input v-model="memberSearch" type="text" :placeholder="t('common.search')" @input="debouncedFetch" />
        </div>
        <select v-model="categoryFilter" class="form-control" style="width:auto;" @change="fetchContributions(1)">
          <option value="">All Categories</option>
          <option value="Monthly Dues">Monthly Dues</option>
          <option value="Tithe / Asrat">Tithe / Asrat (ዐሥራት)</option>
          <option value="Building Fund">Building Fund (ሕንፃ መሥሪያ)</option>
          <option value="Special Offering / Sebit">Special Offering / Sebit</option>
          <option value="Sunday School">Sunday School (ሰንበት ትምህርት ቤት)</option>
          <option value="Charity / Edir">Charity / Edir</option>
        </select>
        <input type="month" class="form-control" v-model="monthFilter" @change="fetchContributions(1)" style="width:auto;" />
        <button v-if="monthFilter || categoryFilter" class="btn btn-ghost btn-sm" @click="monthFilter=''; categoryFilter=''; fetchContributions(1)">
          {{ t('common.all') }}
        </button>
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
                    <th>{{ t('common.name') }}</th>
                    <th>{{ t('common.phone') }}</th>
                    <th>Category</th>
                    <th>{{ t('common.amount') }}</th>
                    <th>{{ t('contributions.monthCovered') }}</th>
                    <th>{{ t('contributions.datePaid') }}</th>
                    <th>{{ t('contributions.recordedBy') }}</th>
                    <th>{{ t('common.note') }}</th>
                    <th>{{ t('common.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in contributions" :key="c.id">
                    <td><span style="font-weight:600;">{{ c.member_name }}</span></td>
                    <td class="text-muted">{{ c.member_phone }}</td>
                    <td>
                      <span class="badge badge-info">{{ c.category || 'Monthly Dues' }}</span>
                    </td>
                    <td><span style="font-weight:700;color:var(--gold);">{{ formatCurrency(c.amount) }}</span></td>
                    <td>
                      <span class="badge badge-gold">{{ formatMonthLabel(c.month_covered) }}</span>
                    </td>
                    <td class="text-muted" style="font-size:0.8rem;">{{ formatDate(c.date_paid) }}</td>
                    <td class="text-muted" style="font-size:0.8rem;">{{ c.recorded_by_name }}</td>
                    <td class="text-muted" style="font-size:0.8rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                      {{ c.note || '—' }}
                    </td>
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
            <!-- Pagination -->
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
    <ReceiptModal
      :show="showReceiptModal"
      :contribution="selectedReceipt"
      @close="showReceiptModal = false"
    />

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
                  <input
                    v-model="memberSearchInput"
                    type="text"
                    class="form-control"
                    :placeholder="t('common.search')"
                    @input="searchMembers"
                    @focus="showMemberDropdown = true"
                  />
                  <div v-if="showMemberDropdown && memberSuggestions.length" class="member-dropdown">
                    <div
                      v-for="m in memberSuggestions"
                      :key="m.id"
                      class="member-suggestion"
                      @click="selectMember(m)"
                    >
                      <span style="font-weight:600;">{{ m.full_name }}</span>
                      <span class="text-muted" style="font-size:0.8rem;">{{ m.phone }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="logForm.member_id" class="badge badge-success mt-1">
                  ✓ {{ selectedMemberName }}
                </div>
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
const showLogModal = ref(false)
const deleteTarget = ref(null)
const formError = ref('')
const formSuccess = ref(false)
const memberSearch = ref('')
const monthFilter = ref('')
const categoryFilter = ref('')
const pagination = ref({ total: 0, page: 1, limit: 15, pages: 1 })

// Receipt Modal state
const showReceiptModal = ref(false)
const selectedReceipt = ref(null)

function openReceipt(c) {
  selectedReceipt.value = c
  showReceiptModal.value = true
}

// Member search in modal
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
  try {
    const params = { page, limit: 15 }
    if (monthFilter.value) params.month = monthFilter.value
    if (categoryFilter.value) params.category = categoryFilter.value
    const res = await api.get('/api/contributions', { params })
    contributions.value = res.data.data
    pagination.value = res.data.pagination
  } catch (e) { console.error(e) }
  finally { loading.value = false }
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
    // Reset form
    logForm.value = {
      member_id: null,
      category: 'Monthly Dues',
      amount: '',
      month_covered: new Date().toISOString().slice(0, 7),
      date_paid: new Date().toISOString().split('T')[0],
      note: '',
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

onMounted(() => fetchContributions())
</script>

<style scoped>
.member-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
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

.member-suggestion:hover {
  background: var(--bg-glass-hover);
}

@media (max-width: 600px) {
  .card-footer {
    flex-direction: column;
    gap: 0.75rem;
    align-items: center;
  }
}
</style>
