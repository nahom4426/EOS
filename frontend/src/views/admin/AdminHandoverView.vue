<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">🏦 Handover Settlement</h1>
        <p class="page-subtitle">Reconcile and settle mini-admin cash pools</p>
      </div>
      <button class="btn btn-ghost btn-sm" @click="fetchSummary" :disabled="loading">🔄 Refresh</button>
    </div>

    <div class="page-content">
      <!-- Top summary strip -->
      <div class="grid-3 mb-3">
        <div class="stat-card">
          <div class="stat-icon gold">💰</div>
          <div>
            <div class="stat-value">{{ formatCurrency(grandTotal) }} ETB</div>
            <div class="stat-label">{{ activeTab === 'settled' ? 'Total Settled Pool' : 'Total Unsettled Pool' }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="color:#805ad5;">🚚</div>
          <div>
            <div class="stat-value">{{ dispatchedCount }}</div>
            <div class="stat-label">Dispatched to Admin</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="color:#ed8936;">⏳</div>
          <div>
            <div class="stat-value">{{ heldCount }}</div>
            <div class="stat-label">Still With Mini-Admins</div>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs: Unsettled vs Settled History -->
      <div class="view-toggle mb-3">
        <button
          class="btn btn-sm"
          :class="activeTab === 'unsettled' ? 'btn-primary' : 'btn-ghost'"
          @click="switchTab('unsettled')"
        >
          ⏳ Unsettled Pools &amp; Batches
        </button>
        <button
          class="btn btn-sm"
          :class="activeTab === 'settled' ? 'btn-primary' : 'btn-ghost'"
          @click="switchTab('settled')"
        >
          ✅ Settled Batches History
        </button>
      </div>

      <!-- Global bulk-settle bar (shown when items selected on unsettled tab) -->
      <div v-if="activeTab === 'unsettled' && globalSelected.length" class="bulk-settle-bar mb-2">
        <span class="text-muted">{{ globalSelected.length }} contribution(s) selected — {{ formatCurrency(globalSelectedTotal) }} ETB</span>
        <button class="btn btn-primary btn-sm" @click="bulkSettle(globalSelected)" :disabled="settling">
          <span v-if="settling" class="spinner spinner-sm"></span>
          ✅ Settle Selected
        </button>
        <div v-if="settleMsg" class="badge" :class="settleOk ? 'badge-success' : 'badge-danger'">{{ settleMsg }}</div>
      </div>

      <div v-if="settleMsg && !globalSelected.length" class="alert mb-2" :class="settleOk ? 'alert-success' : 'alert-danger'">
        {{ settleMsg }}
      </div>

      <div v-if="loading" class="loading-overlay" style="min-height:200px;"><div class="spinner"></div></div>

      <div v-else-if="!miniAdmins.length" class="empty-state" style="padding:4rem;">
        <div class="empty-icon">🏦</div>
        <div class="empty-text">
          {{ activeTab === 'settled' ? 'No settled contribution history found.' : 'No unsettled balances found. All contributions are settled!' }}
        </div>
      </div>

      <!-- Per Mini-Admin cards -->
      <div v-else>
        <div v-for="ma in miniAdmins" :key="ma.mini_admin_id" class="card mb-3">
          <!-- Card header with MA info + settle button -->
          <div class="card-header" style="cursor:pointer;" @click="toggleExpand(ma.mini_admin_id)">
            <div style="display:flex;align-items:center;gap:1rem;flex:1;">
              <div class="ma-avatar">{{ ma.mini_admin_name?.charAt(0) }}</div>
              <div>
                <div class="ma-name">{{ ma.mini_admin_name }}</div>
                <div class="ma-meta">
                  📞 {{ ma.mini_admin_phone }} ·
                  {{ ma.pending_count }} contribution(s) ·
                  <span
                    class="badge"
                    :class="activeTab === 'settled' ? 'badge-success' : (ma.dispatched_count > 0 ? 'badge-info' : 'badge-warning')"
                    style="font-size:0.68rem;"
                  >
                    <template v-if="activeTab === 'settled'">✅ Settled</template>
                    <template v-else>{{ ma.dispatched_count }} dispatched / {{ ma.pending_count - ma.dispatched_count }} held</template>
                  </span>
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:1rem;flex-shrink:0;">
              <div style="text-align:right;">
                <div class="ma-total">{{ formatCurrency(ma.total_amount) }} ETB</div>
                <div class="text-muted" style="font-size:0.72rem;">
                  {{ activeTab === 'settled' ? 'Total Settled' : 'Unsettled Balance' }}
                </div>
              </div>
              <button
                v-if="activeTab === 'unsettled'"
                class="btn btn-primary btn-sm"
                @click.stop="settleAll(ma)"
                :disabled="settling"
                title="Settle all contributions for this mini-admin"
              >
                <span v-if="settling && settlingId === ma.mini_admin_id" class="spinner spinner-sm"></span>
                ✅ Settle All
              </button>
              <span class="collapse-icon">{{ expanded.has(ma.mini_admin_id) ? '▼' : '▶' }}</span>
            </div>
          </div>

          <!-- Expanded detail table grouped by Batch -->
          <div v-if="expanded.has(ma.mini_admin_id)" class="card-body" style="padding:0.75rem;">
            <div v-if="activeTab === 'unsettled'" class="detail-toolbar mb-2" style="border-radius:var(--radius-sm);">
              <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.82rem;cursor:pointer;">
                <input
                  type="checkbox"
                  :checked="allGroupSelected(ma)"
                  @change="toggleGroupSelect(ma)"
                />
                <span style="font-weight:600;">Select All Contributions</span>
              </label>
              <button
                v-if="groupSelected(ma).length"
                class="btn btn-primary btn-xs"
                @click="bulkSettle(groupSelected(ma))"
                :disabled="settling"
              >✅ Settle Selected ({{ groupSelected(ma).length }})</button>
            </div>

            <!-- Batches list -->
            <div class="batches-container">
              <div
                v-for="(batch, bIdx) in getBatchesForMiniAdmin(ma)"
                :key="batch.batch_id || ('unbatched_' + bIdx)"
                class="batch-card mb-2"
              >
                <!-- Batch Card Header -->
                <div class="batch-card-header">
                  <div style="display:flex;align-items:center;gap:0.75rem;flex:1;">
                    <input
                      v-if="activeTab === 'unsettled'"
                      type="checkbox"
                      :checked="allBatchSelected(batch)"
                      @change="toggleBatchSelect(batch)"
                    />
                    <div>
                      <div style="font-weight:700;font-size:0.875rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                        <span>📦 {{ batch.is_unbatched ? 'Direct / Individual Entry' : 'Batch: ' + batch.batch_id.slice(0, 8) + '...' }}</span>
                        <span
                          class="badge"
                          :class="activeTab === 'settled' ? 'badge-success' : (batch.batch_status === 'DISPATCHED_TO_ADMIN' ? 'badge-info' : 'badge-warning')"
                          style="font-size:0.68rem;"
                        >
                          <template v-if="activeTab === 'settled'">✅ Settled</template>
                          <template v-else>{{ batch.batch_status === 'DISPATCHED_TO_ADMIN' ? '🚚 Dispatched' : '💼 Held' }}</template>
                        </span>
                      </div>
                      <div class="text-muted" style="font-size:0.75rem;">
                        {{ batch.entry_count }} contribution(s) · Received {{ formatDate(batch.date_received) }}
                        <span v-if="batch.date_settled"> · Settled {{ formatDate(batch.date_settled) }}</span>
                      </div>
                    </div>
                  </div>

                  <div style="display:flex;align-items:center;gap:0.75rem;flex-shrink:0;">
                    <div style="text-align:right;">
                      <div style="font-weight:800;color:var(--gold);font-size:0.95rem;">
                        {{ formatCurrency(batch.total_amount) }} ETB
                      </div>
                    </div>
                    <button
                      v-if="activeTab === 'unsettled'"
                      class="btn btn-primary btn-xs"
                      @click="settleBatch(batch)"
                      :disabled="settling"
                      title="Settle all contributions in this batch"
                    >
                      ✅ Settle Batch
                    </button>
                    <button
                      v-else-if="activeTab === 'settled'"
                      class="btn btn-ghost btn-xs undo-btn"
                      @click="unsettleBatch(batch)"
                      :disabled="settling"
                      title="Revert/Rollback this batch to unsettled state if settled by error"
                    >
                      ↺ Undo / Unsettle Batch
                    </button>
                  </div>
                </div>

                <!-- Batch Table -->
                <div class="table-wrapper" style="border:none;border-radius:0;">
                  <table class="table" style="font-size:0.82rem;margin:0;">
                    <thead>
                      <tr>
                        <th v-if="activeTab === 'unsettled'" style="width:32px;"></th>
                        <th>Member</th>
                        <th>Phone</th>
                        <th>Months</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Date Received</th>
                        <th>{{ activeTab === 'settled' ? 'Date Settled' : 'Date Dispatched' }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="c in batch.contributions" :key="c.id">
                        <td v-if="activeTab === 'unsettled'">
                          <input
                            type="checkbox"
                            :value="c.id"
                            v-model="selectedIds"
                          />
                        </td>
                        <td><span style="font-weight:600;">{{ c.member_name }}</span></td>
                        <td class="text-muted">{{ c.member_phone }}</td>
                        <td>
                          <span v-for="m in getMonths(c.months_covered)" :key="m" class="badge badge-gold" style="font-size:0.63rem;margin-right:0.2rem;">{{ m }}</span>
                        </td>
                        <td style="font-weight:700;color:var(--gold);">{{ formatCurrency(c.amount) }} ETB</td>
                        <td>
                          <span
                            :class="['badge', c.status === 'SETTLED_WITH_ADMIN' ? 'badge-success' : (c.status === 'DISPATCHED_TO_ADMIN' ? 'badge-info' : 'badge-warning')]"
                            style="font-size:0.7rem;"
                          >
                            {{ c.status === 'SETTLED_WITH_ADMIN' ? '✅ Settled' : (c.status === 'DISPATCHED_TO_ADMIN' ? '🚚 Dispatched' : '💼 Held') }}
                          </span>
                        </td>
                        <td class="text-muted" style="font-size:0.76rem;">{{ formatDate(c.mini_admin_received_at) }}</td>
                        <td class="text-muted" style="font-size:0.76rem;">
                          {{ activeTab === 'settled' ? formatDate(c.admin_approved_at) : (c.handover_dispatched_at ? formatDate(c.handover_dispatched_at) : '—') }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../../api/axios'

const miniAdmins = ref([])
const activeTab = ref('unsettled') // 'unsettled' or 'settled'
const loading = ref(false)
const settling = ref(false)
const settlingId = ref(null)
const selectedIds = ref([])
const settleMsg = ref('')
const settleOk = ref(true)
const expanded = ref(new Set())

const grandTotal = computed(() =>
  miniAdmins.value.reduce((s, ma) => s + parseFloat(ma.total_amount || 0), 0)
)

const dispatchedCount = computed(() =>
  miniAdmins.value.reduce((s, ma) => s + (ma.dispatched_count || 0), 0)
)

const heldCount = computed(() =>
  miniAdmins.value.reduce((s, ma) => s + (ma.pending_count - (ma.dispatched_count || 0)), 0)
)

const globalSelected = computed(() => selectedIds.value)

const globalSelectedTotal = computed(() => {
  const allContribs = miniAdmins.value.flatMap(ma => ma.contributions || [])
  return allContribs
    .filter(c => selectedIds.value.includes(c.id))
    .reduce((s, c) => s + parseFloat(c.amount || 0), 0)
})

function switchTab(tab) {
  activeTab.value = tab
  fetchSummary()
}

function getBatchesForMiniAdmin(ma) {
  if (!ma || !ma.contributions) return []
  const map = new Map()

  ma.contributions.forEach(c => {
    const key = c.batch_id || `unbatched_${c.id}`
    if (!map.has(key)) {
      map.set(key, {
        batch_id: c.batch_id,
        is_unbatched: !c.batch_id,
        date_received: c.mini_admin_received_at || c.date_paid,
        date_dispatched: c.handover_dispatched_at,
        date_settled: c.admin_approved_at,
        contributions: []
      })
    }
    map.get(key).contributions.push(c)
  })

  return Array.from(map.values()).map(b => {
    const totalAmount = b.contributions.reduce((s, c) => s + parseFloat(c.amount || 0), 0)
    const allDispatched = b.contributions.every(c => c.status === 'DISPATCHED_TO_ADMIN')
    const allHeld = b.contributions.every(c => c.status === 'RECEIVED_BY_MINI_ADMIN')
    return {
      ...b,
      total_amount: totalAmount,
      entry_count: b.contributions.length,
      batch_status: allDispatched ? 'DISPATCHED_TO_ADMIN' : (allHeld ? 'RECEIVED_BY_MINI_ADMIN' : 'PARTIAL')
    }
  })
}

function allBatchSelected(batch) {
  const ids = batch.contributions.map(c => c.id)
  return ids.length > 0 && ids.every(id => selectedIds.value.includes(id))
}

function toggleBatchSelect(batch) {
  const ids = batch.contributions.map(c => c.id)
  if (allBatchSelected(batch)) {
    selectedIds.value = selectedIds.value.filter(id => !ids.includes(id))
  } else {
    for (const id of ids) {
      if (!selectedIds.value.includes(id)) selectedIds.value.push(id)
    }
  }
}

async function settleBatch(batch) {
  const ids = batch.contributions.map(c => c.id)
  if (!ids.length) return
  await bulkSettle(ids)
}

async function unsettleBatch(batch) {
  settleMsg.value = ''
  settling.value = true
  try {
    const payload = batch.batch_id
      ? { batch_id: batch.batch_id }
      : { contribution_ids: batch.contributions.map(c => c.id) }
    const res = await api.patch('/api/contributions/admin/unsettle', payload)
    settleMsg.value = `✅ ${res.data.message}`
    settleOk.value = true
    await fetchSummary()
  } catch (e) {
    settleMsg.value = e.response?.data?.error || 'Unsettle failed'
    settleOk.value = false
  } finally {
    settling.value = false
  }
}

function allGroupSelected(ma) {
  const ids = (ma.contributions || []).map(c => c.id)
  return ids.length > 0 && ids.every(id => selectedIds.value.includes(id))
}

function groupSelected(ma) {
  return (ma.contributions || []).map(c => c.id).filter(id => selectedIds.value.includes(id))
}

function toggleGroupSelect(ma) {
  const ids = (ma.contributions || []).map(c => c.id)
  if (allGroupSelected(ma)) {
    selectedIds.value = selectedIds.value.filter(id => !ids.includes(id))
  } else {
    for (const id of ids) {
      if (!selectedIds.value.includes(id)) selectedIds.value.push(id)
    }
  }
}

function toggleExpand(id) {
  if (expanded.value.has(id)) {
    expanded.value.delete(id)
  } else {
    expanded.value.add(id)
  }
}

function getMonths(mc) {
  if (Array.isArray(mc)) return mc
  try { return JSON.parse(mc) } catch { return [] }
}

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('en-ET', { minimumFractionDigits: 2 })
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function fetchSummary() {
  loading.value = true
  settleMsg.value = ''
  selectedIds.value = []
  try {
    const res = await api.get('/api/contributions/handover-summary', {
      params: { status: activeTab.value === 'settled' ? 'settled' : 'active' }
    })
    miniAdmins.value = res.data.mini_admins || []
    expanded.value = new Set()
    if (miniAdmins.value.length > 0) {
      expanded.value.add(miniAdmins.value[0].mini_admin_id)
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function settleAll(ma) {
  const ids = ma.contribution_ids
  if (!ids || !ids.length) return
  settlingId.value = ma.mini_admin_id
  await bulkSettle(ids)
  settlingId.value = null
}

async function bulkSettle(ids) {
  settleMsg.value = ''
  settling.value = true
  try {
    const res = await api.patch('/api/contributions/admin/bulk-approve', { contribution_ids: ids })
    settleMsg.value = `✅ ${res.data.message}`
    settleOk.value = true
    selectedIds.value = selectedIds.value.filter(id => !ids.includes(id))
    await fetchSummary()
  } catch (e) {
    settleMsg.value = e.response?.data?.error || 'Settlement failed'
    settleOk.value = false
  } finally {
    settling.value = false
  }
}

onMounted(() => fetchSummary())
</script>

<style scoped>
.view-toggle {
  display: flex;
  background: var(--bg-secondary);
  padding: 0.2rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.ma-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(212,175,55,0.2), rgba(139,26,26,0.2));
  border: 2px solid var(--gold);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--gold);
  flex-shrink: 0;
}

.ma-name {
  font-size: 0.95rem;
  font-weight: 700;
}

.ma-meta {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-top: 0.1rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.ma-total {
  font-size: 1.1rem;
  font-weight: 900;
  color: var(--gold);
}

.collapse-icon {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.bulk-settle-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.6rem 1rem;
  flex-wrap: wrap;
}

.detail-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.batch-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  overflow: hidden;
}

.batch-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.65rem 1rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.undo-btn {
  color: #dd6b20;
  border-color: rgba(237,137,54,0.4);
}
.undo-btn:hover {
  background: rgba(237,137,54,0.15);
}

.mb-2 { margin-bottom: 0.75rem; }
.mb-3 { margin-bottom: 1.25rem; }
</style>
