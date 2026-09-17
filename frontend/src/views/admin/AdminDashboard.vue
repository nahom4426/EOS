<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('dashboard.welcome') }}, {{ auth.user?.full_name?.split(' ')[0] }} 👋</h1>
        <p class="page-subtitle">{{ t('dashboard.thisMonth') }} — {{ currentMonthLabel }}</p>
      </div>
      <div style="display:flex;gap:0.75rem;">
        <RouterLink to="/admin/contributions" class="btn btn-primary">
          ＋ {{ t('contributions.logContribution') }}
        </RouterLink>
        <RouterLink to="/admin/members" class="btn btn-ghost">
          👥 {{ t('nav.members') }}
        </RouterLink>
      </div>
    </div>

    <div class="page-content">
      <!-- Stat cards -->
      <div class="grid-3 mb-3">
        <div class="stat-card">
          <div class="stat-icon gold">💰</div>
          <div>
            <div class="stat-value">{{ formatCurrency(report.summary?.total_collected || 0) }}</div>
            <div class="stat-label">{{ t('dashboard.totalAmount') }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon success">✅</div>
          <div>
            <div class="stat-value">{{ report.summary?.paying_members || 0 }}</div>
            <div class="stat-label">{{ t('dashboard.paidCount') }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon crimson">⏳</div>
          <div>
            <div class="stat-value">{{ unpaidCount }}</div>
            <div class="stat-label">{{ t('dashboard.unpaidCount') }}</div>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <!-- Paid vs Unpaid visual -->
        <div class="card">
          <div class="card-header">
            <h3 style="color:var(--gold);font-size:0.95rem;">{{ t('dashboard.thisMonth') }}</h3>
          </div>
          <div class="card-body">
            <div v-if="loading" class="loading-overlay"><div class="spinner"></div></div>
            <div v-else>
              <!-- Progress bar -->
              <div style="margin-bottom:1rem;">
                <div style="display:flex;justify-content:space-between;margin-bottom:0.4rem;font-size:0.8rem;color:var(--text-muted);">
                  <span>{{ t('common.paid') }}: {{ report.summary?.paying_members || 0 }}</span>
                  <span>{{ t('common.total') }}: {{ report.summary?.total_members || 0 }}</span>
                </div>
                <div style="height:10px;background:var(--bg-input);border-radius:999px;overflow:hidden;">
                  <div
                    style="height:100%;background:linear-gradient(90deg,var(--success),#2E8B57);border-radius:999px;transition:width 0.8s cubic-bezier(0.4,0,0.2,1);"
                    :style="{ width: paidPercent + '%' }"
                  ></div>
                </div>
                <div style="text-align:right;font-size:0.75rem;color:var(--text-muted);margin-top:0.3rem;">{{ paidPercent }}%</div>
              </div>

              <!-- Unpaid member list preview -->
              <div v-if="unpaidMembers.length">
                <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted);margin-bottom:0.6rem;">
                  {{ t('members.unpaidThisMonth') }}
                </div>
                <div v-for="m in unpaidMembers.slice(0,5)" :key="m.id" style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-bottom:1px solid var(--border-color);">
                  <div style="width:32px;height:32px;background:var(--danger-bg);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:var(--danger);">
                    {{ m.full_name.charAt(0) }}
                  </div>
                  <div>
                    <div style="font-size:0.875rem;font-weight:500;">{{ m.full_name }}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);">{{ m.phone }}</div>
                  </div>
                </div>
                <RouterLink to="/admin/members" class="btn btn-ghost btn-sm w-full mt-2">
                  {{ t('dashboard.viewAll') }} →
                </RouterLink>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent contributions -->
        <div class="card">
          <div class="card-header">
            <h3 style="color:var(--gold);font-size:0.95rem;">{{ t('dashboard.recentContributions') }}</h3>
            <RouterLink to="/admin/contributions" class="btn btn-ghost btn-sm">{{ t('dashboard.viewAll') }}</RouterLink>
          </div>
          <div class="card-body" style="padding:0;">
            <div v-if="recentLoading" class="loading-overlay"><div class="spinner"></div></div>
            <div v-else-if="!recentContributions.length" class="empty-state" style="padding:2rem;">
              <div class="empty-icon">💰</div>
              <div class="empty-text">{{ t('common.noData') }}</div>
            </div>
            <div v-else>
              <div v-for="c in recentContributions" :key="c.id" class="contribution-item">
                <div class="contrib-avatar">{{ c.member_name?.charAt(0) }}</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:0.875rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ c.member_name }}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted);">{{ formatMonthLabel(c.month_covered) }}</div>
                </div>
                <div style="font-weight:700;color:var(--gold);white-space:nowrap;">{{ formatCurrency(c.amount) }}</div>
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
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/auth'
import api from '../../api/axios'

const { t } = useI18n()
const auth = useAuthStore()
const loading = ref(false)
const recentLoading = ref(false)
const report = ref({ summary: {}, members: [] })
const recentContributions = ref([])

const currentMonthLabel = computed(() => {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

const unpaidMembers = computed(() =>
  (report.value.members || []).filter(m => !m.paid)
)

const unpaidCount = computed(() =>
  (report.value.summary?.total_members || 0) - (report.value.summary?.paying_members || 0)
)

const paidPercent = computed(() => {
  const total = report.value.summary?.total_members || 0
  const paid = report.value.summary?.paying_members || 0
  return total > 0 ? Math.round((paid / total) * 100) : 0
})

function formatCurrency(val) {
  return new Intl.NumberFormat('en-ET', { minimumFractionDigits: 2 }).format(val) + ' ETB'
}

function formatMonthLabel(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

async function fetchReport() {
  loading.value = true
  try {
    const month = new Date().toISOString().slice(0, 7)
    const res = await api.get('/api/reports/branch', { params: { month } })
    report.value = res.data
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

async function fetchRecent() {
  recentLoading.value = true
  try {
    const res = await api.get('/api/contributions', { params: { limit: 8 } })
    recentContributions.value = res.data.data
  } catch (e) { console.error(e) }
  finally { recentLoading.value = false }
}

onMounted(() => { fetchReport(); fetchRecent() })
</script>

<style scoped>
.contribution-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.15s;
}

.contribution-item:hover { background: var(--bg-glass); }
.contribution-item:last-child { border-bottom: none; }

.contrib-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(212,175,55,0.2), rgba(139,26,26,0.2));
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--gold);
  flex-shrink: 0;
}
</style>
