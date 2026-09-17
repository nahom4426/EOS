<template>
  <div>
    <!-- Header -->
    <div style="margin-bottom:1.5rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
      <div style="display:flex;align-items:center;gap:1rem;">
        <img v-if="getAvatarUrl(auth.user?.avatar_url)" :src="getAvatarUrl(auth.user?.avatar_url)" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid var(--gold);" />
        <div v-else style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg, rgba(212,175,55,0.2), rgba(139,26,26,0.2));border:2px solid var(--gold);display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:700;color:var(--gold);">
          {{ auth.user?.full_name?.charAt(0) || '👤' }}
        </div>
        <div>
          <h1 class="page-title">{{ t('myContributions.title') }}</h1>
          <p class="text-muted" style="margin-top:0.1rem;">
            {{ auth.user?.full_name }}
          </p>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" @click="openAnnualStatement">
        📜 Download Annual Statement
      </button>
    </div>

    <!-- Member Score & Consistency Rating Banner -->
    <div class="card score-card mb-3">
      <div class="score-card-body">
        <div class="score-main font-bold">
          <div class="score-badge-large">
            <span class="tier-emoji">{{ summary.tierBadge || '🥈' }}</span>
            <div>
              <div class="tier-title" :style="{ color: summary.tierColor || '#718096' }">{{ summary.tier || 'Silver Member' }} Tier</div>
              <div class="score-subtitle">Consistency Rating: <strong>{{ summary.score || 50 }}/100</strong></div>
            </div>
          </div>

          <div class="score-metrics-row">
            <div class="score-stat-box">
              <span class="s-val text-warning">🔥 {{ summary.streakMonths || 0 }} Months</span>
              <span class="s-lbl">Active Streak</span>
            </div>
            <div class="score-stat-box">
              <span class="s-val text-info">📅 {{ summary.monthsPaidCount || 0 }} / 12</span>
              <span class="s-lbl">Months Paid (12m)</span>
            </div>
          </div>
        </div>

        <div class="score-progress-bar-track mt-2">
          <div
            class="score-progress-bar-fill"
            :style="{ width: (summary.score || 50) + '%', background: summary.tierColor || '#718096' }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Summary cards -->
    <div class="grid-2 mb-3">
      <div class="stat-card">
        <div class="stat-icon gold">💰</div>
        <div>
          <div class="stat-value">{{ formatCurrency(summary.total_contributed || 0) }}</div>
          <div class="stat-label">{{ t('myContributions.totalContributed') }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon success">📅</div>
        <div>
          <div class="stat-value" style="font-size:1.1rem;">
            {{ summary.last_payment_date ? formatDate(summary.last_payment_date) : '—' }}
          </div>
          <div class="stat-label">{{ t('myContributions.lastPayment') }}</div>
        </div>
      </div>
    </div>

    <!-- Filter -->
    <div class="toolbar mb-2">
      <label class="form-label" style="white-space:nowrap;">{{ t('myContributions.filterByMonth') }}</label>
      <input type="month" class="form-control" v-model="selectedMonth" @change="fetchContributions(1)" style="width:auto;" />
      <button v-if="selectedMonth" class="btn btn-ghost btn-sm" @click="selectedMonth=''; fetchContributions(1)">
        {{ t('myContributions.allTime') }}
      </button>
    </div>

    <!-- Contributions list -->
    <div class="card">
      <div class="card-body" style="padding:0;">
        <div v-if="loading" class="loading-overlay"><div class="spinner"></div></div>
        <div v-else-if="!contributions.length" class="empty-state">
          <div class="empty-icon">✝</div>
          <div class="empty-text">{{ t('myContributions.noContributions') }}</div>
        </div>
        <div v-else>
          <!-- Contribution cards -->
          <div v-for="c in contributions" :key="c.id" class="contribution-row">
            <div class="contrib-month-badge">
              <div class="contrib-month-year">{{ new Date(c.month_covered).getFullYear() }}</div>
              <div class="contrib-month-name">{{ getMonthAbbr(c.month_covered) }}</div>
            </div>
            <div style="flex:1;">
              <div style="font-size:0.875rem;font-weight:600;color:var(--text-primary);display:flex;align-items:center;gap:0.5rem;">
                {{ formatMonthLabel(c.month_covered) }}
                <span class="badge badge-info" style="font-size:0.7rem;">{{ c.category || 'Monthly Dues' }}</span>
              </div>
              <div style="font-size:0.78rem;color:var(--text-muted);">
                {{ t('contributions.datePaid') }}: {{ formatDate(c.date_paid) }}
              </div>
              <div v-if="c.note" style="font-size:0.78rem;color:var(--text-muted);margin-top:0.15rem;">
                📝 {{ c.note }}
              </div>
            </div>
            <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:0.25rem;">
              <div style="font-size:1.1rem;font-weight:800;color:var(--gold);">{{ formatCurrency(c.amount) }}</div>
              <button class="btn btn-ghost btn-xs" @click="openReceipt(c)">🧾 Receipt</button>
            </div>
          </div>

          <!-- Pagination -->
          <div class="card-footer flex justify-between items-center">
            <span class="text-muted" style="font-size:0.8rem;">
              {{ t('common.page') }} {{ pagination.page }} {{ t('common.of') }} {{ pagination.pages }}
              ({{ pagination.total }} {{ t('common.total').toLowerCase() }})
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

    <!-- Modals -->
    <ReceiptModal
      :show="showReceiptModal"
      :contribution="selectedReceipt"
      @close="showReceiptModal = false"
    />

    <AnnualStatementModal
      :show="showStatementModal"
      :member="auth.user ? { ...auth.user, score: summary.score, tier: summary.tier, tierBadge: summary.tierBadge, streakMonths: summary.streakMonths } : null"
      :contributions="contributions"
      :year="statementYear"
      @close="showStatementModal = false"
      @year-change="statementYear = $event"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/auth'
import api from '../../api/axios'
import { getAvatarUrl } from '../../utils/avatar'
import ReceiptModal from '../../components/ReceiptModal.vue'
import AnnualStatementModal from '../../components/AnnualStatementModal.vue'

const { t } = useI18n()
const auth = useAuthStore()
const contributions = ref([])
const summary = ref({ total_contributed: 0, last_payment_date: null, score: 50, tier: 'Silver', tierBadge: '🥈', streakMonths: 0, monthsPaidCount: 0 })
const loading = ref(false)
const selectedMonth = ref('')
const pagination = ref({ total: 0, page: 1, limit: 15, pages: 1 })

// Modal states
const showReceiptModal = ref(false)
const selectedReceipt = ref(null)
const showStatementModal = ref(false)
const statementYear = ref(new Date().getFullYear())

function openReceipt(c) {
  selectedReceipt.value = {
    ...c,
    member_name: auth.user?.full_name,
    member_phone: auth.user?.phone
  }
  showReceiptModal.value = true
}

function openAnnualStatement() {
  showStatementModal.value = true
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getMonthAbbr(d) { return MONTHS_EN[new Date(d).getMonth()] }

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
    if (selectedMonth.value) params.month = selectedMonth.value
    const res = await api.get('/api/my-contributions', { params })
    contributions.value = res.data.data
    summary.value = res.data.summary
    pagination.value = res.data.pagination
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

onMounted(() => fetchContributions())
</script>

<style scoped>
.score-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
}

.score-card-body {
  padding: 1.25rem 1.5rem;
}

.score-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.score-badge-large {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.tier-emoji {
  font-size: 2.4rem;
}

.tier-title {
  font-size: 1.15rem;
  font-weight: 800;
}

.score-subtitle {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.score-metrics-row {
  display: flex;
  gap: 1.5rem;
}

.score-stat-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.s-val {
  font-size: 1.05rem;
  font-weight: 800;
}

.s-lbl {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.score-progress-bar-track {
  width: 100%;
  height: 8px;
  background: var(--bg-hover, #edf2f7);
  border-radius: 4px;
  overflow: hidden;
  margin-top: 0.85rem;
}

.score-progress-bar-fill {
  height: 100%;
  transition: width 0.5s ease;
  border-radius: 4px;
}

.contribution-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.15s;
}

.contribution-row:hover { background: var(--bg-glass); }
.contribution-row:last-child { border-bottom: none; }

.contrib-month-badge {
  width: 52px;
  height: 52px;
  background: linear-gradient(135deg, rgba(212,175,55,0.15), rgba(139,26,26,0.15));
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.contrib-month-year {
  font-size: 0.6rem;
  color: var(--text-muted);
  font-weight: 600;
}

.contrib-month-name {
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--gold);
  line-height: 1;
}

@media (max-width: 600px) {
  .contribution-row {
    padding: 0.85rem 1rem;
    gap: 0.75rem;
  }
  .score-metrics-row {
    width: 100%;
    justify-content: space-between;
  }
  .score-stat-box {
    align-items: flex-start;
  }
  .card-footer {
    flex-direction: column;
    gap: 0.75rem;
    align-items: center;
  }
}
</style>

