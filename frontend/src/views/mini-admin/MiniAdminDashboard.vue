<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">📊 Mini-Admin Dashboard</h1>
        <p class="page-subtitle">Cash Handover &amp; Verification Center</p>
      </div>
      <div style="display:flex;gap:0.5rem;align-items:center;">
        <RouterLink to="/mini-admin/members" class="btn btn-primary btn-sm">
          👥 Create &amp; Manage Members
        </RouterLink>
        <button class="btn btn-ghost btn-sm" @click="fetchAll" :disabled="loading">
          🔄 Refresh
        </button>
      </div>
    </div>

    <div class="page-content">
      <!-- Stat widgets -->
      <div class="grid-3 mb-3">
        <div class="stat-card pending-card">
          <div class="stat-icon" style="color:#ed8936;">⏳</div>
          <div>
            <div class="stat-value">{{ formatCurrency(metrics.pending_deliveries?.total || 0) }} ETB</div>
            <div class="stat-label">Awaiting from First Children</div>
            <div class="stat-sub">{{ metrics.pending_deliveries?.batch_count || 0 }} batch(es)</div>
          </div>
        </div>
        <div class="stat-card held-card">
          <div class="stat-icon gold">💼</div>
          <div>
            <div class="stat-value">{{ formatCurrency(metrics.cash_held?.total || 0) }} ETB</div>
            <div class="stat-label">Cash Held (Ready to Dispatch)</div>
            <div class="stat-sub">{{ metrics.cash_held?.contribution_count || 0 }} contribution(s)</div>
          </div>
        </div>
        <div class="stat-card dispatched-card">
          <div class="stat-icon" style="color:#805ad5;">🚚</div>
          <div>
            <div class="stat-value">{{ formatCurrency(dispatchedTotal) }} ETB</div>
            <div class="stat-label">Dispatched to Admin</div>
            <div class="stat-sub">{{ dispatchedCount }} contribution(s)</div>
          </div>
        </div>
      </div>

      <!-- ── Section 1: Pending First Child Deliveries ── -->
      <div class="card mb-3">
        <div class="card-header">
          <h3 class="card-title">📦 Pending First Child Deliveries</h3>
          <div v-if="selectedBatches.length" class="batch-actions">
            <button class="btn btn-primary btn-sm" @click="verifySelected" :disabled="verifying">
              <span v-if="verifying" class="spinner spinner-sm"></span>
              ✅ Verify Selected ({{ selectedBatches.length }})
            </button>
          </div>
        </div>

        <div v-if="loading" class="loading-overlay"><div class="spinner"></div></div>

        <div v-else-if="!pendingQueue.length" class="empty-state" style="padding:2.5rem;">
          <div class="empty-icon">✅</div>
          <div class="empty-text">No pending deliveries — all batches received!</div>
        </div>

        <div v-else class="card-body" style="padding:0;">
          <div class="queue-select-bar">
            <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
              <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" />
              <span class="text-muted" style="font-size:0.82rem;">Select All</span>
            </label>
            <span class="text-muted" style="font-size:0.8rem;">{{ pendingQueue.length }} pending batch(es)</span>
          </div>
          <div v-for="batch in pendingQueue" :key="batch.batch_id" class="queue-row">
            <label class="queue-checkbox-area">
              <input type="checkbox" :value="batch.batch_id" v-model="selectedBatches" />
            </label>
            <div style="flex:1;">
              <div style="font-weight:600;font-size:0.9rem;">Submitted by: {{ batch.submitted_by || 'Unknown' }}</div>
              <div class="text-muted" style="font-size:0.78rem;">
                Batch: <code>{{ batch.batch_id?.slice(0, 8) }}...</code>
                · {{ batch.entry_count }} contribution(s) · {{ formatDate(batch.submitted_at) }}
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-weight:700;color:var(--gold);">{{ formatCurrency(batch.batch_amount) }} ETB</div>
              <button class="btn btn-primary btn-xs mt-1" @click="verifySingleBatch(batch.batch_id)" :disabled="verifying">✅ Verify</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Section 2: Cash Transfer to Admin ── -->
      <div class="card mb-3">
        <div class="card-header">
          <h3 class="card-title">🏦 Cash Transfer to Admin</h3>
          <span v-if="heldContributions.length" class="badge badge-gold">{{ heldContributions.length }} ready</span>
        </div>

        <div v-if="!heldContributions.length" class="empty-state" style="padding:2.5rem;">
          <div class="empty-icon">🏦</div>
          <div class="empty-text">No verified cash ready to dispatch. Verify received batches first.</div>
        </div>

        <div v-else class="card-body">
          <div class="form-group mb-2">
            <label class="form-label">Handover Notes (optional)</label>
            <input v-model="dispatchNotes" type="text" class="form-control" placeholder="e.g. Delivered in person on Sep 22" />
          </div>

          <div class="held-list mb-2">
            <div class="held-list-header">
              <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
                <input type="checkbox" :checked="allHeldSelected" @change="toggleAllHeld" />
                <span class="text-muted" style="font-size:0.8rem;">Select All</span>
              </label>
              <span style="font-weight:700;color:var(--gold);font-size:0.85rem;">
                Total: {{ formatCurrency(selectedHeldTotal) }} ETB
              </span>
            </div>
            <div v-for="c in heldContributions" :key="c.id" class="held-row">
              <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
                <input type="checkbox" :value="c.id" v-model="selectedHeldIds" />
              </label>
              <div style="flex:1;">
                <div style="font-size:0.875rem;font-weight:600;">{{ c.member_name }}</div>
                <div class="text-muted" style="font-size:0.75rem;">
                  <span v-for="m in getMonths(c.months_covered)" :key="m" class="badge badge-gold" style="font-size:0.63rem;margin-right:0.2rem;">{{ m }}</span>
                  · Received {{ formatDate(c.mini_admin_received_at) }}
                </div>
              </div>
              <div style="font-weight:700;color:var(--gold);">{{ formatCurrency(c.amount) }} ETB</div>
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:0.75rem;align-items:center;flex-wrap:wrap;">
            <div v-if="dispatchMsg" class="badge" :class="dispatchOk ? 'badge-success' : 'badge-danger'">{{ dispatchMsg }}</div>
            <button class="btn btn-primary" @click="dispatchToAdmin" :disabled="dispatching || !selectedHeldIds.length">
              <span v-if="dispatching" class="spinner spinner-sm"></span>
              🚚 Dispatch{{ selectedHeldIds.length ? ` (${selectedHeldIds.length})` : '' }} Cash to Admin
            </button>
          </div>
        </div>
      </div>

      <!-- ── Section 3: Verified Batches & Lifecycle Tracker ── -->
      <div class="card mb-3">
        <div class="card-header" style="flex-wrap:wrap;gap:0.75rem;">
          <h3 class="card-title">📋 Verified Batches &amp; Lifecycle Tracker</h3>
          <div class="history-filter-tabs" style="display:flex;gap:0.35rem;flex-wrap:wrap;">
            <button
              class="btn btn-xs"
              :class="historyFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'"
              @click="historyFilter = 'ALL'"
            >
              All Verified ({{ allVerifiedCount }})
            </button>
            <button
              class="btn btn-xs"
              :class="historyFilter === 'RECEIVED_BY_MINI_ADMIN' ? 'btn-primary' : 'btn-ghost'"
              @click="historyFilter = 'RECEIVED_BY_MINI_ADMIN'"
            >
              💼 Cash Held ({{ heldCount }})
            </button>
            <button
              class="btn btn-xs"
              :class="historyFilter === 'DISPATCHED_TO_ADMIN' ? 'btn-primary' : 'btn-ghost'"
              @click="historyFilter = 'DISPATCHED_TO_ADMIN'"
            >
              🚚 Dispatched ({{ dispatchedStateCount }})
            </button>
            <button
              class="btn btn-xs"
              :class="historyFilter === 'SETTLED_WITH_ADMIN' ? 'btn-primary' : 'btn-ghost'"
              @click="historyFilter = 'SETTLED_WITH_ADMIN'"
            >
              ✅ Settled ({{ settledCount }})
            </button>
          </div>
        </div>

        <div v-if="!filteredHistory.length" class="empty-state" style="padding:2.5rem;">
          <div class="empty-icon">📜</div>
          <div class="empty-text">No verified contributions found for this status.</div>
        </div>

        <div v-else class="table-wrapper" style="border:none;border-radius:0;">
          <table class="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Months / Amount</th>
                <th>Batch ID</th>
                <th>Verified Date</th>
                <th>Lifecycle Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in filteredHistory" :key="c.id">
                <td>
                  <div style="font-weight:600;font-size:0.875rem;">{{ c.member_name }}</div>
                  <div class="text-muted" style="font-size:0.75rem;">{{ c.member_phone }}</div>
                </td>
                <td>
                  <div style="font-weight:700;color:var(--gold);">{{ formatCurrency(c.amount) }} ETB</div>
                  <div style="font-size:0.75rem;">
                    <span v-for="m in getMonths(c.months_covered)" :key="m" class="badge badge-gold" style="font-size:0.63rem;margin-right:0.2rem;">{{ m }}</span>
                  </div>
                </td>
                <td class="text-muted" style="font-size:0.8rem;">
                  <code>{{ c.batch_id ? c.batch_id.slice(0, 8) + '...' : '—' }}</code>
                </td>
                <td class="text-muted" style="font-size:0.8rem;">
                  {{ formatDate(c.mini_admin_received_at || c.created_at) }}
                </td>
                <td>
                  <span v-if="c.status === 'RECEIVED_BY_MINI_ADMIN'" class="badge badge-warning" style="display:inline-flex;align-items:center;gap:0.3rem;">
                    💼 Cash Held by You
                  </span>
                  <span v-else-if="c.status === 'DISPATCHED_TO_ADMIN'" class="badge badge-info" style="display:inline-flex;align-items:center;gap:0.3rem;">
                    🚚 Dispatched to Admin
                  </span>
                  <span v-else-if="c.status === 'SETTLED_WITH_ADMIN' || c.status === 'SETTLED'" class="badge badge-success" style="display:inline-flex;align-items:center;gap:0.3rem;">
                    ✅ Settled by Admin
                  </span>
                  <span v-else class="badge badge-ghost">
                    {{ c.status }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="verifySuccess" class="alert alert-success mt-2">✅ {{ verifySuccess }}</div>
      <div v-if="verifyError" class="alert alert-danger mt-2">{{ verifyError }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import api from '../../api/axios'

const metrics = ref({ cash_held: {}, pending_deliveries: {} })
const pendingQueue = ref([])
const heldContributions = ref([])
const verifiedHistory = ref([])
const historyFilter = ref('ALL')
const dispatchedTotal = ref(0)
const dispatchedCount = ref(0)
const loading = ref(false)
const verifying = ref(false)
const dispatching = ref(false)
const selectedBatches = ref([])
const selectedHeldIds = ref([])
const dispatchNotes = ref('')
const verifySuccess = ref('')
const verifyError = ref('')
const dispatchMsg = ref('')
const dispatchOk = ref(true)

const allSelected = computed(() =>
  pendingQueue.value.length > 0 && selectedBatches.value.length === pendingQueue.value.length
)
const allHeldSelected = computed(() =>
  heldContributions.value.length > 0 && selectedHeldIds.value.length === heldContributions.value.length
)
const selectedHeldTotal = computed(() =>
  heldContributions.value
    .filter(c => selectedHeldIds.value.includes(c.id))
    .reduce((s, c) => s + parseFloat(c.amount || 0), 0)
)

const allVerifiedCount = computed(() => verifiedHistory.value.length)
const heldCount = computed(() => verifiedHistory.value.filter(c => c.status === 'RECEIVED_BY_MINI_ADMIN').length)
const dispatchedStateCount = computed(() => verifiedHistory.value.filter(c => c.status === 'DISPATCHED_TO_ADMIN').length)
const settledCount = computed(() => verifiedHistory.value.filter(c => c.status === 'SETTLED_WITH_ADMIN' || c.status === 'SETTLED').length)

const filteredHistory = computed(() => {
  if (historyFilter.value === 'ALL') return verifiedHistory.value
  if (historyFilter.value === 'SETTLED_WITH_ADMIN') {
    return verifiedHistory.value.filter(c => c.status === 'SETTLED_WITH_ADMIN' || c.status === 'SETTLED')
  }
  return verifiedHistory.value.filter(c => c.status === historyFilter.value)
})

function toggleSelectAll() {
  allSelected.value ? (selectedBatches.value = []) : (selectedBatches.value = pendingQueue.value.map(b => b.batch_id))
}
function toggleAllHeld() {
  allHeldSelected.value ? (selectedHeldIds.value = []) : (selectedHeldIds.value = heldContributions.value.map(c => c.id))
}

function getMonths(mc) {
  if (Array.isArray(mc)) return mc
  try { return JSON.parse(mc) } catch { return [] }
}
function formatCurrency(v) { return Number(v || 0).toLocaleString('en-ET', { minimumFractionDigits: 2 }) }
function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function fetchAll() {
  loading.value = true
  verifySuccess.value = ''
  verifyError.value = ''
  try {
    const res = await api.get('/api/reports/dashboard-metrics')
    metrics.value = res.data
    pendingQueue.value = res.data.pending_batch_queue || []
    selectedBatches.value = []

    // Held contributions for dispatch panel
    const heldRes = await api.get('/api/contributions', { params: { status: 'RECEIVED_BY_MINI_ADMIN', limit: 100 } })
    heldContributions.value = heldRes.data?.data || []
    selectedHeldIds.value = []

    // Dispatched stats
    const dispRes = await api.get('/api/contributions', { params: { status: 'DISPATCHED_TO_ADMIN', limit: 1 } })
    dispatchedCount.value = dispRes.data?.pagination?.total || 0
    const dispAllRes = await api.get('/api/contributions', { params: { status: 'DISPATCHED_TO_ADMIN', limit: 500 } })
    dispatchedTotal.value = (dispAllRes.data?.data || []).reduce((s, c) => s + parseFloat(c.amount || 0), 0)

    // All verified history for lifecycle tracker
    const historyRes = await api.get('/api/contributions', { params: { limit: 200 } })
    verifiedHistory.value = (historyRes.data?.data || []).filter(c => c.status !== 'SUBMITTED')
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function verifySingleBatch(batchId) {
  verifySuccess.value = ''
  verifyError.value = ''
  verifying.value = true
  try {
    const res = await api.patch('/api/contributions/mini-admin/verify-batch', { batch_id: batchId })
    verifySuccess.value = res.data.message
    await fetchAll()
  } catch (e) {
    verifyError.value = e.response?.data?.error || 'Verification failed'
  } finally {
    verifying.value = false
  }
}

async function verifySelected() {
  verifySuccess.value = ''
  verifyError.value = ''
  if (!selectedBatches.value.length) return
  verifying.value = true
  try {
    let count = 0
    for (const batchId of selectedBatches.value) {
      await api.patch('/api/contributions/mini-admin/verify-batch', { batch_id: batchId })
      count++
    }
    verifySuccess.value = `${count} batch(es) verified successfully`
    await fetchAll()
  } catch (e) {
    verifyError.value = e.response?.data?.error || 'Verification failed'
    await fetchAll()
  } finally {
    verifying.value = false
  }
}

async function dispatchToAdmin() {
  dispatchMsg.value = ''
  dispatching.value = true
  try {
    const payload = { notes: dispatchNotes.value || undefined }
    if (selectedHeldIds.value.length < heldContributions.value.length) {
      payload.contribution_ids = selectedHeldIds.value
    }
    const res = await api.patch('/api/contributions/mini-admin/dispatch-handover', payload)
    dispatchMsg.value = `${res.data.message} — ${formatCurrency(res.data.total_amount)} ETB`
    dispatchOk.value = true
    dispatchNotes.value = ''
    await fetchAll()
  } catch (e) {
    dispatchMsg.value = e.response?.data?.error || 'Dispatch failed'
    dispatchOk.value = false
  } finally {
    dispatching.value = false
  }
}

onMounted(() => fetchAll())
</script>

<style scoped>
.held-card     { border-left: 3px solid var(--gold); }
.pending-card  { border-left: 3px solid #ed8936; }
.dispatched-card { border-left: 3px solid #805ad5; }

.stat-sub { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem; }

.queue-select-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 1.25rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.queue-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.15s;
}
.queue-row:last-child { border-bottom: none; }
.queue-row:hover { background: var(--bg-glass); }
.queue-checkbox-area { cursor: pointer; padding: 0.25rem; }
.batch-actions { display: flex; gap: 0.5rem; }
.mt-1 { margin-top: 0.25rem; }
.mt-2 { margin-top: 0.75rem; }
.mb-2 { margin-bottom: 0.75rem; }
.mb-3 { margin-bottom: 1.25rem; }

.held-list {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.held-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 1rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.held-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.875rem;
  transition: background 0.15s;
}
.held-row:last-child { border-bottom: none; }
.held-row:hover { background: var(--bg-glass); }
</style>
