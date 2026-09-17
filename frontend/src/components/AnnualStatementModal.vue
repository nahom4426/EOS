<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-container statement-modal-container">
        <div class="modal-header no-print">
          <h3 class="modal-title">
            <span>📜</span> Annual Contribution Statement ({{ selectedYear }})
          </h3>
          <div class="header-actions">
            <select v-model="selectedYear" class="year-select" @change="$emit('year-change', selectedYear)">
              <option v-for="y in availableYears" :key="y" :value="y">{{ y }}</option>
            </select>
            <button class="btn btn-primary btn-sm" @click="printStatement">
              🖨️ Print Statement
            </button>
            <button class="btn-icon" @click="$emit('close')" title="Close">✕</button>
          </div>
        </div>

        <!-- Printable Statement Body -->
        <div class="statement-paper" id="printable-statement">
          <!-- Header -->
          <div class="statement-header">
            <div class="statement-emblem">✝️</div>
            <div class="statement-church">
              <h2>የኢትዮጵያ ኦርቶዶክስ ተዋሕዶ ቤተ ክርስቲያን</h2>
              <h3>Ethiopian Orthodox Tewahedo Church</h3>
              <p>{{ member?.branch_name || 'Church Branch' }}</p>
            </div>
          </div>

          <div class="statement-title-banner">
            ANNUAL CONTRIBUTION STATEMENT — {{ selectedYear }}
            <div class="subtitle-geez">የዓመታዊ ክፍያ መግለጫ</div>
          </div>

          <!-- Member Info Bar -->
          <div class="member-info-box">
            <div class="info-row">
              <div><strong>Member Name / አባል፡</strong> {{ member?.full_name || 'N/A' }}</div>
              <div><strong>Phone / ስልክ፡</strong> {{ member?.phone || 'N/A' }}</div>
            </div>
            <div class="info-row" style="margin-top: 0.5rem;">
              <div><strong>Consistency Rating:</strong> {{ member?.tierBadge || '🥈' }} {{ member?.tier || 'Silver' }} (Score: {{ member?.score || 50 }}/100)</div>
              <div><strong>Statement Date:</strong> {{ currentDate }}</div>
            </div>
          </div>

          <!-- Summary Metric Cards -->
          <div class="statement-summary-grid">
            <div class="metric-card">
              <span class="m-label">Total Annual Contribution</span>
              <span class="m-val">{{ formatCurrency(annualTotal) }} ETB</span>
            </div>
            <div class="metric-card">
              <span class="m-label">Active Months Paid</span>
              <span class="m-val">{{ monthsPaidCount }} / 12 Months</span>
            </div>
            <div class="metric-card">
              <span class="m-label">Active Streak</span>
              <span class="m-val">{{ member?.streakMonths || 0 }} Months 🔥</span>
            </div>
          </div>

          <!-- 12 Month Table Breakdown -->
          <table class="statement-table">
            <thead>
              <tr>
                <th>Month / ወር</th>
                <th>Category / ዓይነት</th>
                <th>Date Paid / የተከፈለው ቀን</th>
                <th>Status / ሁኔታ</th>
                <th style="text-align: right;">Amount (ETB)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in monthlyBreakdown" :key="m.monthKey">
                <td><strong>{{ m.monthLabel }}</strong></td>
                <td>
                  <span v-if="m.paid" class="cat-pill">{{ m.category }}</span>
                  <span v-else>—</span>
                </td>
                <td>{{ m.datePaid ? formatDate(m.datePaid) : '—' }}</td>
                <td>
                  <span :class="['status-pill', m.paid ? 'paid' : 'pending']">
                    {{ m.paid ? '✓ Paid' : '— Unpaid' }}
                  </span>
                </td>
                <td style="text-align: right; font-weight: 700;">
                  {{ m.paid ? formatCurrency(m.amount) : '0.00' }}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" style="text-align: right; font-weight: 800;">TOTAL CONTRIBUTIONS ({{ selectedYear }}):</td>
                <td style="text-align: right; font-weight: 900; color: #742a2a; font-size: 1.1rem;">
                  {{ formatCurrency(annualTotal) }} ETB
                </td>
              </tr>
            </tfoot>
          </table>

          <!-- Verification Seal -->
          <div class="statement-seal-block">
            <div class="seal-note">
              This annual contribution statement is an official record issued by the Ethiopian Orthodox Tewahedo Church.
            </div>
            <div class="seal-signatures">
              <div class="sig-col">
                <div class="sig-line"></div>
                <span>Treasurer / ሒሳብ ሹም</span>
              </div>
              <div class="sig-col">
                <div class="seal-circle">OFFICIAL SEAL</div>
              </div>
              <div class="sig-col">
                <div class="sig-line"></div>
                <span>Parish Administrator / አስተዳዳሪ</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  show: { type: Boolean, default: false },
  member: { type: Object, default: null },
  contributions: { type: Array, default: () => [] },
  year: { type: Number, default: new Date().getFullYear() }
});

const emit = defineEmits(['close', 'year-change']);

const selectedYear = ref(props.year || new Date().getFullYear());
const availableYears = computed(() => {
  const current = new Date().getFullYear();
  return [current, current - 1, current - 2, current - 3];
});

const currentDate = computed(() => {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
});

const monthlyBreakdown = computed(() => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const yr = selectedYear.value;

  const result = [];
  months.forEach((name, idx) => {
    const monthNum = String(idx + 1).padStart(2, '0');
    const monthPrefix = `${yr}-${monthNum}`;

    // Find contribution for this month
    const match = props.contributions.find(c => {
      const cMonth = typeof c.month_covered === 'string'
        ? c.month_covered.slice(0, 7)
        : new Date(c.month_covered).toISOString().slice(0, 7);
      return cMonth === monthPrefix;
    });

    if (match) {
      result.push({
        monthKey: monthPrefix,
        monthLabel: `${name} ${yr}`,
        paid: true,
        amount: Number(match.amount),
        category: match.category || 'Monthly Dues',
        datePaid: match.date_paid
      });
    } else {
      result.push({
        monthKey: monthPrefix,
        monthLabel: `${name} ${yr}`,
        paid: false,
        amount: 0,
        category: '—',
        datePaid: null
      });
    }
  });

  return result;
});

const annualTotal = computed(() => {
  return monthlyBreakdown.value.reduce((sum, item) => sum + item.amount, 0);
});

const monthsPaidCount = computed(() => {
  return monthlyBreakdown.value.filter(item => item.paid).length;
});

function formatCurrency(val) {
  return Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function printStatement() {
  window.print();
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

.statement-modal-container {
  background: var(--bg-card, #ffffff);
  color: var(--text-primary, #1a202c);
  border-radius: 16px;
  width: 100%;
  max-width: 780px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color, #e2e8f0);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.year-select {
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #cbd5e0;
  background: #ffffff;
  font-weight: 700;
  color: #2b6cb0;
}

.statement-paper {
  padding: 2.5rem;
  background: #ffffff;
  color: #1a202c;
  font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
}

.statement-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  text-align: center;
  margin-bottom: 1.25rem;
}

.statement-emblem {
  font-size: 2.8rem;
  color: #d4af37;
}

.statement-church h2 {
  font-size: 1.2rem;
  font-weight: 800;
  color: #742a2a;
  margin: 0;
}

.statement-church h3 {
  font-size: 0.95rem;
  font-weight: 700;
  color: #2b6cb0;
  margin: 0.2rem 0;
}

.statement-church p {
  font-size: 0.85rem;
  color: #4a5568;
  margin: 0;
}

.statement-title-banner {
  background: #742a2a;
  color: #ffffff;
  text-align: center;
  font-weight: 800;
  font-size: 1rem;
  letter-spacing: 1px;
  padding: 0.6rem 1rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
}

.subtitle-geez {
  font-size: 0.85rem;
  font-weight: 600;
  color: #feebc8;
}

.member-info-box {
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  font-size: 0.9rem;
  margin-bottom: 1.25rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.statement-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.metric-card {
  background: #ebf8ff;
  border: 1px solid #bee3f8;
  border-radius: 8px;
  padding: 0.85rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.m-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #2b6cb0;

  text-transform: uppercase;
}

.m-val {
  font-size: 1.15rem;
  font-weight: 900;
  color: #2c5282;
}

.statement-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 2rem;
  font-size: 0.88rem;
}

.statement-table th,
.statement-table td {
  padding: 0.65rem 0.85rem;
  border: 1px solid #e2e8f0;
}

.statement-table th {
  background: #edf2f7;
  color: #2d3748;
  font-weight: 700;
  text-align: left;
}

.cat-pill {
  background: #edf2f7;
  color: #2d3748;
  padding: 0.15rem 0.5rem;
  border-radius: 12px;
  font-size: 0.78rem;
  font-weight: 600;
}

.status-pill.paid {
  color: #276749;
  font-weight: 700;
}

.status-pill.pending {
  color: #a0aec0;
}

.statement-seal-block {
  margin-top: 2rem;
  padding-top: 1.25rem;
  border-top: 1px solid #e2e8f0;
}

.seal-note {
  font-size: 0.78rem;
  color: #718096;
  text-align: center;
  margin-bottom: 1.75rem;
  font-style: italic;
}

.seal-signatures {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.sig-col {
  width: 180px;
  text-align: center;
  font-size: 0.78rem;
  font-weight: 700;
  color: #4a5568;
}

.sig-line {
  border-bottom: 1px dashed #a0aec0;
  margin-bottom: 0.4rem;
}

.seal-circle {
  width: 76px;
  height: 76px;
  border: 2px dashed #d4af37;
  border-radius: 50%;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 800;
  color: #b7791f;
}

@media print {
  body * {
    visibility: hidden;
  }
  .modal-overlay {
    position: static;
    background: none;
    padding: 0;
  }
  .statement-modal-container {
    box-shadow: none;
    border: none;
    max-width: 100%;
  }
  .no-print {
    display: none !important;
  }
  #printable-statement, #printable-statement * {
    visibility: visible;
  }
  #printable-statement {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    padding: 2cm;
  }
}
</style>
