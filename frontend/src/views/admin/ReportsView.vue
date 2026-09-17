<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('reports.title') }}</h1>
        <p class="page-subtitle">{{ t('reports.monthlyReport') }}</p>
      </div>
      <div style="display:flex;gap:0.75rem;align-items:center;">
        <input type="month" class="form-control" v-model="selectedMonth" @change="fetchReport" style="width:auto;" />
        <button class="btn btn-success" @click="exportCSV">
          📥 {{ t('reports.exportCSV') }}
        </button>
      </div>
    </div>

    <div class="page-content">
      <div v-if="loading" class="loading-overlay"><div class="spinner"></div></div>
      <template v-else>
        <!-- Summary cards -->
        <div class="grid-4 mb-3">
          <div class="stat-card">
            <div class="stat-icon gold">💰</div>
            <div>
              <div class="stat-value">{{ formatCurrency(report.summary?.total_collected || 0) }}</div>
              <div class="stat-label">{{ t('reports.totalCollected') }}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon success">✅</div>
            <div>
              <div class="stat-value">{{ report.summary?.paying_members || 0 }}</div>
              <div class="stat-label">{{ t('reports.paidMembers') }}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon crimson">⏳</div>
            <div>
              <div class="stat-value">{{ (report.summary?.total_members || 0) - (report.summary?.paying_members || 0) }}</div>
              <div class="stat-label">{{ t('reports.unpaidMembers') }}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon warning">👥</div>
            <div>
              <div class="stat-value">{{ report.summary?.total_members || 0 }}</div>
              <div class="stat-label">{{ t('reports.totalMembers') }}</div>
            </div>
          </div>
        </div>

        <!-- Member status table -->
        <div class="card">
          <div class="card-header">
            <h3 style="color:var(--gold);">{{ t('reports.monthlyReport') }}</h3>
            <span class="badge badge-info">{{ formatMonthLabel(report.summary?.month) }}</span>
          </div>
          <div class="card-body" style="padding:0;">
            <div v-if="!report.members?.length" class="empty-state">
              <div class="empty-icon">📋</div>
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
                      <th>{{ t('common.status') }}</th>
                      <th>{{ t('common.amount') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(m, i) in paginatedMembers" :key="m.id">
                      <td class="text-muted" style="font-size:0.8rem;">{{ (currentPage - 1) * pageSize + i + 1 }}</td>
                      <td><span style="font-weight:600;">{{ m.full_name }}</span></td>
                      <td class="text-muted">{{ m.phone }}</td>
                      <td>
                        <span class="badge" :class="m.paid ? 'badge-success' : 'badge-danger'">
                          {{ m.paid ? t('common.paid') : t('common.unpaid') }}
                        </span>
                      </td>
                      <td>
                        <span :style="{ fontWeight: 700, color: m.paid ? 'var(--success)' : 'var(--text-muted)' }">
                          {{ m.paid ? formatCurrency(m.amount_paid) : '—' }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Pagination -->
              <div class="card-footer flex justify-between items-center">
                <span class="text-muted" style="font-size:0.8rem;">
                  {{ t('common.page') }} {{ currentPage }} {{ t('common.of') }} {{ totalPages }}
                </span>
                <div class="pagination">
                  <button class="pagination-btn" :disabled="currentPage <= 1" @click="currentPage--">‹</button>
                  <button v-for="p in visiblePages" :key="p" class="pagination-btn" :class="{ active: p === currentPage }" @click="currentPage = p">{{ p }}</button>
                  <button class="pagination-btn" :disabled="currentPage >= totalPages" @click="currentPage++">›</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../../api/axios'

const { t } = useI18n()
const loading = ref(false)
const report = ref({ summary: {}, members: [] })
const selectedMonth = ref(new Date().toISOString().slice(0, 7))
const currentPage = ref(1)
const pageSize = 15

const totalPages = computed(() =>
  Math.ceil((report.value.members?.length || 0) / pageSize)
)

const paginatedMembers = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return (report.value.members || []).slice(start, start + pageSize)
})

const visiblePages = computed(() => {
  const pages = []
  const start = Math.max(1, currentPage.value - 2)
  const end = Math.min(totalPages.value, currentPage.value + 2)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

function formatCurrency(val) {
  return new Intl.NumberFormat('en-ET', { minimumFractionDigits: 2 }).format(val) + ' ETB'
}

function formatMonthLabel(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

async function fetchReport() {
  loading.value = true
  currentPage.value = 1
  try {
    const res = await api.get('/api/reports/branch', { params: { month: selectedMonth.value } })
    report.value = res.data
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

async function exportCSV() {
  try {
    const params = selectedMonth.value ? { month: selectedMonth.value } : {}
    const res = await api.get('/api/reports/branch/export', {
      params,
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `contributions_${selectedMonth.value || 'all'}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (e) { console.error(e) }
}

onMounted(fetchReport)
</script>

<style scoped>
@media (max-width: 600px) {
  .card-footer {
    flex-direction: column;
    gap: 0.75rem;
    align-items: center;
  }
}
</style>
