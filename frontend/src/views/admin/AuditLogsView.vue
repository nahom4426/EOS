<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">🔍 System Audit Logs</h1>
        <p class="page-subtitle">Security events, system updates, and administrative logs</p>
      </div>
      <button class="btn btn-ghost btn-sm" @click="fetchLogs(1)" :disabled="loading">
        🔄 {{ loading ? 'Refreshing...' : 'Refresh Logs' }}
      </button>
    </div>

    <div class="page-content">
      <!-- Toolbar Filters -->
      <div class="toolbar mb-2">
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by user, action..."
            @input="debounceFetch"
          />
        </div>

        <select v-model="selectedAction" class="form-control" style="width:auto;" @change="fetchLogs(1)">
          <option value="">All Action Types</option>
          <option value="CREATE_CONTRIBUTION">Create Contribution</option>
          <option value="DELETE_CONTRIBUTION">Delete Contribution</option>
          <option value="CREATE_MEMBER">Create Member</option>
          <option value="UPDATE_MEMBER">Update Member</option>
          <option value="DEACTIVATE_MEMBER">Deactivate Member</option>
          <option value="ACTIVATE_MEMBER">Activate Member</option>
          <option value="LOGIN">User Login</option>
        </select>
      </div>


      <!-- Logs Table Card -->
      <div class="card">
        <div class="card-body" style="padding:0;">
          <div v-if="loading" class="loading-overlay"><div class="spinner"></div></div>
          <div v-else-if="!logs.length" class="empty-state">
            <div class="empty-icon">📜</div>
            <div class="empty-text">No Audit Logs Found</div>
          </div>
          <div v-else>
            <div class="table-wrapper" style="border:none;border-radius:0;">
              <table class="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Role</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>IP Address</th>
                    <th>Location</th>
                    <th style="text-align: right;">Details</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="log in logs" :key="log.id">
                    <td class="text-muted" style="font-size:0.8rem;white-space:nowrap;font-family:monospace;">
                      {{ formatDateTime(log.created_at) }}
                    </td>
                    <td>
                      <span style="font-weight:600;">{{ log.user_name || 'System' }}</span>
                    </td>
                    <td>
                      <span :class="['badge', getRoleBadgeClass(log.user_role)]">
                        {{ log.user_role }}
                      </span>
                    </td>
                    <td>
                      <span :class="['badge', getActionBadgeClass(log.action)]">
                        {{ log.action }}
                      </span>
                    </td>
                    <td>
                      <span v-if="log.entity_type" class="entity-tag">
                        {{ log.entity_type }} #{{ log.entity_id || 'N/A' }}
                      </span>
                      <span v-else class="text-muted">—</span>
                    </td>
                    <td class="text-muted" style="font-size:0.75rem;font-family:monospace;">
                      {{ log.ip_address || '127.0.0.1' }}
                    </td>
                    <td class="text-muted" style="font-size:0.8rem;white-space:nowrap;">
                      <span v-if="log.location">📍 {{ log.location }}</span>
                      <span v-else class="text-muted">—</span>
                    </td>
                    <td style="text-align: right;">
                      <button
                        v-if="log.details"
                        class="btn btn-ghost btn-sm btn-icon"
                        @click="inspectDetails(log)"
                        title="View Details"
                      >
                        👁️
                      </button>
                      <span v-else class="text-muted">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination Footer -->
            <div class="card-footer flex justify-between items-center">
              <span class="text-muted" style="font-size:0.8rem;">
                Page {{ pagination.page }} of {{ pagination.pages }} ({{ pagination.total }} total entries)
              </span>
              <div class="pagination">
                <button
                  class="pagination-btn"
                  :disabled="pagination.page <= 1"
                  @click="changePage(pagination.page - 1)"
                >‹</button>
                <button
                  v-for="p in visiblePages"
                  :key="p"
                  class="pagination-btn"
                  :class="{ active: p === pagination.page }"
                  @click="changePage(p)"
                >{{ p }}</button>
                <button
                  class="pagination-btn"
                  :disabled="pagination.page >= pagination.pages"
                  @click="changePage(pagination.page + 1)"
                >›</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Details Inspector Modal -->
    <Teleport to="body">
      <div v-if="selectedLog" class="modal-overlay" @click.self="selectedLog = null">
        <div class="modal" style="max-width:540px;">
          <div class="modal-header">
            <span class="modal-title">Log Details — {{ selectedLog.action }}</span>
            <button class="btn btn-ghost btn-sm btn-icon" @click="selectedLog = null">✕</button>
          </div>
          <div class="modal-body" style="padding:1.25rem;">
            <pre class="json-box">{{ formatJson(selectedLog.details) }}</pre>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../../api/axios'

const logs = ref([])
const loading = ref(false)
const searchQuery = ref('')
const selectedAction = ref('')
const selectedLog = ref(null)

const pagination = ref({
  page: 1,
  limit: 15,
  total: 0,
  pages: 1
})

let debounceTimer = null

const visiblePages = computed(() => {
  const pages = []
  const { page, pages: total } = pagination.value
  const start = Math.max(1, page - 2)
  const end = Math.min(total, page + 2)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

async function fetchLogs(page = 1) {
  loading.value = true
  const pageNum = typeof page === 'number' ? page : 1
  try {
    const res = await api.get('/api/audit-logs', {
      params: {
        search: searchQuery.value || undefined,
        action: selectedAction.value || undefined,
        page: pageNum,
        limit: 15
      }
    })
    logs.value = res.data.data
    pagination.value = res.data.pagination
  } catch (err) {
    console.error('Error loading audit logs:', err)
  } finally {
    loading.value = false
  }
}


function debounceFetch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    fetchLogs(1)
  }, 300)
}

function changePage(newPage) {
  fetchLogs(newPage)
}

function inspectDetails(log) {
  selectedLog.value = log
}

function formatJson(val) {
  if (!val) return 'No details recorded.'
  if (typeof val === 'string') {
    try {
      return JSON.stringify(JSON.parse(val), null, 2)
    } catch {
      return val
    }
  }
  return JSON.stringify(val, null, 2)
}

function formatDateTime(str) {
  if (!str) return 'N/A'
  return new Date(str).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getRoleBadgeClass(role) {
  switch (role) {
    case 'superadmin': return 'badge-danger'
    case 'branch_admin': return 'badge-warning'
    case 'member': return 'badge-info'
    default: return 'badge-gold'
  }
}

function getActionBadgeClass(action) {
  if (!action) return 'badge-gold'
  if (action.startsWith('CREATE') || action.startsWith('ACTIVATE')) return 'badge-success'
  if (action.startsWith('DELETE') || action.startsWith('DEACTIVATE')) return 'badge-danger'
  if (action.startsWith('UPDATE')) return 'badge-warning'
  return 'badge-info'
}

onMounted(() => {
  fetchLogs(1)
})
</script>

<style scoped>
.entity-tag {
  background: var(--bg-glass-hover, rgba(0,0,0,0.05));
  color: var(--text-primary);
  font-family: monospace;
  font-size: 0.8rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.json-box {
  background: var(--bg-secondary, #1a202c);
  color: var(--gold, #d4af37);
  padding: 1.25rem;
  border-radius: 8px;
  font-family: monospace;
  font-size: 0.88rem;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
}
</style>
