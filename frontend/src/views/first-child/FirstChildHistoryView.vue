<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">📋 Submission History</h1>
        <p class="page-subtitle">Track your submitted batches and handover status</p>
      </div>
      <button class="btn btn-ghost btn-sm" @click="fetchHistory" :disabled="loading">🔄 Refresh</button>
    </div>

    <div class="page-content">
      <!-- Summary stats -->
      <div class="grid-3 mb-3">
        <div class="stat-card">
          <div class="stat-icon gold">💰</div>
          <div>
            <div class="stat-value">{{ formatCurrency(summary.total_contributed || 0) }}</div>
            <div class="stat-label">Total Contributed</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon success">✅</div>
          <div>
            <div class="stat-value">{{ settledCount }}</div>
            <div class="stat-label">Settled with Church</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon crimson">⏳</div>
          <div>
            <div class="stat-value">{{ pendingCount }}</div>
            <div class="stat-label">In Pipeline</div>
          </div>
        </div>
      </div>

      <!-- Filter -->
      <div class="toolbar mb-2">
        <label class="form-label" style="white-space:nowrap;">Filter by Month</label>
        <input type="month" class="form-control" v-model="selectedMonth" @change="fetchHistory()" style="width:auto;" />
        <button v-if="selectedMonth" class="btn btn-ghost btn-sm" @click="selectedMonth=''; fetchHistory()">All Time</button>
      </div>

      <!-- History list -->
      <div class="card">
        <div class="card-body" style="padding:0;">
          <div v-if="loading" class="loading-overlay"><div class="spinner"></div></div>
          <div v-else-if="!contributions.length" class="empty-state" style="padding:3rem;">
            <div class="empty-icon">📋</div>
            <div class="empty-text">No submission history found.</div>
          </div>
          <div v-else>
            <!-- Group by batch_id -->
            <div v-for="batch in groupedBatches" :key="batch.batch_id" class="batch-block">
              <!-- Batch header -->
              <div class="batch-header" @click="toggleBatch(batch.batch_id)">
                <div style="display:flex;align-items:center;gap:0.75rem;flex:1;min-width:0;">
                  <div class="batch-collapse-icon">{{ expandedBatches.has(batch.batch_id) ? '▼' : '▶' }}</div>
                  <div>
                    <div class="batch-id">Batch <code>{{ batch.batch_id?.slice(0, 8) }}…</code></div>
                    <div class="batch-meta">
                      {{ batch.entries.length }} contribution(s) ·
                      Submitted {{ formatDate(batch.submitted_at) }}
                    </div>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:1rem;flex-shrink:0;">
                  <span :class="['pipeline-badge', pipelineClass(batch.status)]">
                    {{ pipelineLabel(batch.status) }}
                  </span>
                  <span style="font-weight:800;color:var(--gold);">{{ formatCurrency(batch.batch_total) }} ETB</span>
                  <button
                    class="btn btn-ghost btn-xs"
                    @click.stop="openReceipt(batch.entries[0])"
                    title="Print first entry receipt"
                  >🧾</button>
                </div>
              </div>

              <!-- Expanded rows -->
              <div v-if="expandedBatches.has(batch.batch_id)" class="batch-details">
                <div v-for="c in batch.entries" :key="c.id" class="detail-row">
                  <div style="flex:1;">
                    <div class="detail-member">{{ c.member_name }}</div>
                    <div class="detail-months">
                      <span v-if="c.months_covered?.length">
                        <span v-for="m in getMonths(c.months_covered)" :key="m" class="badge badge-gold" style="font-size:0.65rem;margin-right:0.2rem;">{{ m }}</span>
                      </span>
                    </div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-weight:700;color:var(--gold);">{{ formatCurrency(c.amount) }} ETB</div>
                    <span :class="['badge', statusBadgeClass(c.status)]" style="font-size:0.65rem;">{{ statusLabel(c.status) }}</span>
                  </div>
                  <button class="btn btn-ghost btn-xs" @click="openReceipt(c)" title="Print receipt">🧾</button>
                </div>
              </div>
            </div>

            <!-- Pagination -->
            <div class="card-footer flex justify-between items-center">
              <span class="text-muted" style="font-size:0.8rem;">
                Page {{ pagination.page }} of {{ pagination.pages }}
              </span>
              <div class="pagination">
                <button class="pagination-btn" :disabled="pagination.page <= 1" @click="fetchHistory(pagination.page - 1)">‹</button>
                <button v-for="p in visiblePages" :key="p" class="pagination-btn" :class="{ active: p === pagination.page }" @click="fetchHistory(p)">{{ p }}</button>
                <button class="pagination-btn" :disabled="pagination.page >= pagination.pages" @click="fetchHistory(pagination.page + 1)">›</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Receipt Modal -->
    <ReceiptModal :show="showReceiptModal" :contribution="selectedReceipt" @close="showReceiptModal = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../../api/axios'
import { useAuthStore } from '../../stores/auth'
import ReceiptModal from '../../components/ReceiptModal.vue'

const auth = useAuthStore()
const contributions = ref([])
const summary = ref({ total_contributed: 0 })
const loading = ref(false)
const selectedMonth = ref('')
const pagination = ref({ total: 0, page: 1, limit: 20, pages: 1 })
const expandedBatches = ref(new Set())
const showReceiptModal = ref(false)
const selectedReceipt = ref(null)

// Pipeline status ordering: SUBMITTED < RECEIVED_BY_MINI_ADMIN < DISPATCHED_TO_ADMIN < SETTLED_WITH_ADMIN
const STATUS_ORDER = {
  'SUBMITTED': 0,
  'RECEIVED_BY_MINI_ADMIN': 1,
  'DISPATCHED_TO_ADMIN': 2,
  'SETTLED_WITH_ADMIN': 3,
}

const settledCount = computed(() =>
  contributions.value.filter(c => c.status === 'SETTLED_WITH_ADMIN').length
)

const pendingCount = computed(() =>
  contributions.value.filter(c => c.status !== 'SETTLED_WITH_ADMIN').length
)

const groupedBatches = computed(() => {
  const map = new Map()
  for (const c of contributions.value) {
    const key = c.batch_id || `no-batch-${c.id}`
    if (!map.has(key)) {
      map.set(key, {
        batch_id: key,
        entries: [],
        submitted_at: c.created_at,
        batch_total: 0,
        status: c.status,
      })
    }
    const batch = map.get(key)
    batch.entries.push(c)
    batch.batch_total += parseFloat(c.amount || 0)
    // Use the "worst" (earliest pipeline) status across entries
    if (STATUS_ORDER[c.status] < STATUS_ORDER[batch.status]) {
      batch.status = c.status
    }
    if (new Date(c.created_at) < new Date(batch.submitted_at)) {
      batch.submitted_at = c.created_at
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    new Date(b.submitted_at) - new Date(a.submitted_at)
  )
})

const visiblePages = computed(() => {
  const pages = []
  const { page, pages: total } = pagination.value
  const start = Math.max(1, page - 2)
  const end = Math.min(total, page + 2)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

function toggleBatch(batchId) {
  if (expandedBatches.value.has(batchId)) {
    expandedBatches.value.delete(batchId)
  } else {
    expandedBatches.value.add(batchId)
  }
}

function getMonths(mc) {
  if (Array.isArray(mc)) return mc
  try { return JSON.parse(mc) } catch { return [] }
}

function openReceipt(c) {
  selectedReceipt.value = {
    ...c,
    member_name: c.member_name || auth.user?.full_name,
    member_phone: c.member_phone || auth.user?.phone,
  }
  showReceiptModal.value = true
}

function pipelineLabel(s) {
  if (s === 'SUBMITTED') return '⏳ Submitted'
  if (s === 'RECEIVED_BY_MINI_ADMIN') return '📦 With Mini-Admin'
  if (s === 'DISPATCHED_TO_ADMIN') return '🚚 Dispatched to Admin'
  if (s === 'SETTLED_WITH_ADMIN') return '✅ Settled'
  return s
}

function pipelineClass(s) {
  if (s === 'SETTLED_WITH_ADMIN') return 'status-settled'
  if (s === 'DISPATCHED_TO_ADMIN') return 'status-dispatched'
  if (s === 'RECEIVED_BY_MINI_ADMIN') return 'status-received'
  return 'status-submitted'
}

function statusLabel(s) {
  if (s === 'SUBMITTED') return 'Submitted'
  if (s === 'RECEIVED_BY_MINI_ADMIN') return 'With Mini-Admin'
  if (s === 'DISPATCHED_TO_ADMIN') return 'Dispatched'
  if (s === 'SETTLED_WITH_ADMIN') return 'Settled ✓'
  return s
}

function statusBadgeClass(s) {
  if (s === 'SETTLED_WITH_ADMIN') return 'badge-success'
  if (s === 'DISPATCHED_TO_ADMIN') return 'badge-info'
  if (s === 'RECEIVED_BY_MINI_ADMIN') return 'badge-info'
  return 'badge-warning'
}

function formatCurrency(val) {
  return Number(val || 0).toLocaleString('en-ET', { minimumFractionDigits: 2 })
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

async function fetchHistory(page = 1) {
  loading.value = true
  try {
    const params = { page, limit: 20 }
    if (selectedMonth.value) params.month = selectedMonth.value
    const res = await api.get('/api/my-contributions', { params })
    contributions.value = res.data.data || []
    summary.value = res.data.summary || {}
    pagination.value = res.data.pagination || { total: 0, page: 1, limit: 20, pages: 1 }
    // Auto-expand first batch
    if (groupedBatches.value.length > 0) {
      expandedBatches.value.add(groupedBatches.value[0].batch_id)
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => fetchHistory())
</script>

<style scoped>
.batch-block {
  border-bottom: 1px solid var(--border-color);
}
.batch-block:last-child { border-bottom: none; }

.batch-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  cursor: pointer;
  transition: background 0.15s;
}
.batch-header:hover { background: var(--bg-glass); }

.batch-collapse-icon {
  font-size: 0.7rem;
  color: var(--text-muted);
  flex-shrink: 0;
}

.batch-id { font-size: 0.9rem; font-weight: 700; }
.batch-meta { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.1rem; }

.batch-details {
  background: var(--bg-secondary);
  border-top: 1px dashed var(--border-color);
  border-bottom: 1px dashed var(--border-color);
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 2rem;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.875rem;
}
.detail-row:last-child { border-bottom: none; }

.detail-member { font-weight: 600; }
.detail-months { margin-top: 0.2rem; }

.pipeline-badge {
  display: inline-block;
  padding: 0.25rem 0.65rem;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 700;
}

.status-submitted  { background: rgba(237,137,54,0.15); color: #c05621; }
.status-received   { background: rgba(49,130,206,0.15); color: #2b6cb0; }
.status-dispatched { background: rgba(159,122,234,0.15); color: #553c9a; }
.status-settled    { background: rgba(56,161,105,0.15); color: #276749; }
</style>
