<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-container receipt-modal-container">
        <div class="modal-header no-print">
          <h3 class="modal-title">
            <span>🧾</span> Contribution Receipt
          </h3>
          <div class="header-actions">
            <button class="btn btn-primary btn-sm" @click="printReceipt">
              🖨️ Print / Save PDF
            </button>
            <button class="btn-icon" @click="$emit('close')" title="Close">✕</button>
          </div>
        </div>

        <!-- Printable Receipt Body -->
        <div class="receipt-paper" id="printable-receipt">
          <!-- Church Header -->
          <div class="receipt-church-header">
            <div class="receipt-emblem">
              <img src="/assets/images/logo.jpg" alt="ጥቁር አንበሳ ግቢ ጉባኤ Logo" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
            </div>
            <div class="receipt-church-titles">
              <h2>ጥቁር አንበሳ ግቢ ጉባኤ</h2>
              <h3>Tikur Anbessa Gibi Gebeye</h3>
              <p class="receipt-branch-name">{{ contribution?.branch_name || 'Gibi Gebeye Branch' }}</p>
            </div>
          </div>

          <div class="receipt-divider">❖ ❖ ❖</div>

          <div class="receipt-meta-bar">
            <div class="receipt-badge">OFFICIAL RECEIPT / ደረሰኝ</div>
            <div class="receipt-no">Ref: #EOS-REC-{{ String(contribution?.id || '000').padStart(6, '0') }}</div>
          </div>

          <!-- Details Grid -->
          <div class="receipt-body-grid">
            <div class="receipt-field">
              <span class="field-label">Member Name / አባል፡</span>
              <span class="field-value highlight">{{ contribution?.member_name || 'N/A' }}</span>
            </div>

            <div class="receipt-field" v-if="contribution?.member_phone">
              <span class="field-label">Phone Number / ስልክ፡</span>
              <span class="field-value">{{ contribution?.member_phone }}</span>
            </div>

            <!-- Months covered (Ethiopian calendar) -->
            <div class="receipt-field" style="grid-column: 1 / -1;">
              <span class="field-label">Months Covered / የክፍያ ወሮች፡</span>
              <span v-if="monthsDisplay" class="field-value months-display">{{ monthsDisplay }}</span>
              <span v-else class="field-value">{{ formatMonth(contribution?.month_covered) }}</span>
            </div>

            <div class="receipt-field">
              <span class="field-label">Contribution Category / ዓይነት፡</span>
              <span class="field-value category-pill">{{ contribution?.category || 'Monthly Dues' }}</span>
            </div>

            <div class="receipt-field">
              <span class="field-label">Date Paid / ክፍያ የተፈጸመበት ቀን፡</span>
              <span class="field-value">{{ formatDate(contribution?.date_paid) }}</span>
            </div>

            <div class="receipt-field" v-if="contribution?.recorded_by_name">
              <span class="field-label">Recorded By / ተቀባይ፡</span>
              <span class="field-value">{{ contribution?.recorded_by_name }}</span>
            </div>

            <!-- Handover status -->
            <div class="receipt-field" v-if="contribution?.status">
              <span class="field-label">Handover Status / ሁኔታ፡</span>
              <span class="field-value">
                <span :class="['status-dot', statusClass(contribution.status)]"></span>
                {{ statusLabel(contribution.status) }}
              </span>
            </div>
          </div>

          <!-- Amount Box -->
          <div class="receipt-amount-card">
            <div class="amount-label">AMOUNT PAID / የተከፈለው መጠን</div>
            <div class="amount-val">{{ formatCurrency(contribution?.amount) }} ETB</div>
            <div v-if="contribution?.base_rate_applied" class="amount-sub">
              ({{ monthCount }} month(s) × {{ formatCurrency(contribution.base_rate_applied) }} base rate)
            </div>
          </div>

          <div v-if="contribution?.note" class="receipt-note">
            <strong>Note / ማስታወሻ:</strong> {{ contribution?.note }}
          </div>

          <!-- Footer Seal / Stamp & Signature -->
          <div class="receipt-footer-seal">
            <!-- Left: church stamp -->
            <div class="seal-box">
              <img
                v-if="churchStampUrl"
                :src="churchStampUrl"
                crossorigin="anonymous"
                alt="Church Stamp"
                class="stamp-img"
                @error="churchStampUrl = ''"
              />
              <div v-else class="seal-circle">SEAL / ማኅተም</div>
            </div>

            <!-- Right: authorized signature -->
            <div class="sig-box">
              <img
                v-if="authorizedSignatureUrl"
                :src="authorizedSignatureUrl"
                crossorigin="anonymous"
                alt="Authorized Signature"
                class="sig-img"
                @error="authorizedSignatureUrl = ''"
              />
              <div v-else class="sig-line"></div>
              <div class="sig-label">Authorized Signature</div>
            </div>
          </div>

          <div class="receipt-blessing">
            "እግዚአብሔር በደስታ የሚሰጠውን ይወዳል" (2ቆሮ 9:7) <br />
            "God loves a cheerful giver" (2 Cor 9:7)
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, watch, ref } from 'vue'
import api from '../api/axios'

const props = defineProps({
  show: { type: Boolean, default: false },
  contribution: { type: Object, default: null }
})

defineEmits(['close'])

// Stamp / signature URLs fetched from system settings
const churchStampUrl = ref(null)
const authorizedSignatureUrl = ref(null)

// Fetch contribution settings once (and whenever show becomes true)
watch(() => props.show, async (val) => {
  if (val && churchStampUrl.value === null) {
    try {
      const res = await api.get('/api/settings/contribution-settings')
      churchStampUrl.value = res.data.church_stamp_url || null
      authorizedSignatureUrl.value = res.data.authorized_signature_url || null
    } catch (e) {
      // Graceful fallback: leave as null → empty lines shown
      churchStampUrl.value = ''
      authorizedSignatureUrl.value = ''
    }
  }
}, { immediate: false })

/** Compute months display string from months_covered (JSONB array) or fallback */
const monthsDisplay = computed(() => {
  const mc = props.contribution?.months_covered
  if (Array.isArray(mc) && mc.length) return mc.join(', ')
  if (typeof mc === 'string') {
    try { return JSON.parse(mc).join(', ') } catch { return mc }
  }
  return null
})

const monthCount = computed(() => {
  const mc = props.contribution?.months_covered
  if (Array.isArray(mc)) return mc.length
  if (typeof mc === 'string') {
    try { return JSON.parse(mc).length } catch { return 1 }
  }
  return 1
})

function statusLabel(s) {
  if (s === 'SUBMITTED') return 'Submitted'
  if (s === 'RECEIVED_BY_MINI_ADMIN') return 'With Mini-Admin'
  if (s === 'SETTLED_WITH_ADMIN') return 'Settled ✓'
  return s
}

function statusClass(s) {
  if (s === 'SETTLED_WITH_ADMIN') return 'dot-green'
  if (s === 'RECEIVED_BY_MINI_ADMIN') return 'dot-blue'
  return 'dot-yellow'
}

function formatCurrency(val) {
  if (val === undefined || val === null) return '0.00'
  return Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatMonth(dateStr) {
  if (!dateStr) return 'N/A'
  const parts = String(dateStr).split('-')
  if (parts.length < 2) return dateStr
  const year = parts[0]
  const monthIdx = parseInt(parts[1], 10) - 1
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${monthNames[monthIdx] || parts[1]} ${year}`
}

function printReceipt() {
  window.print()
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

.receipt-modal-container {
  background: var(--bg-card, #ffffff);
  color: var(--text-primary, #1a202c);
  border-radius: 16px;
  width: 100%;
  max-width: 580px;
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

.modal-title {
  font-size: 1.15rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* Printable Paper */
.receipt-paper {
  padding: 2rem;
  background: #ffffff;
  color: #1a202c;
  font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
}

.receipt-church-header {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  text-align: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.receipt-emblem { font-size: 2.75rem; color: #d4af37; }

.receipt-church-titles h2 { font-size: 1.15rem; font-weight: 800; color: #742a2a; margin: 0; }
.receipt-church-titles h3 { font-size: 0.95rem; font-weight: 700; color: #2b6cb0; margin: 0.2rem 0; }
.receipt-branch-name { font-size: 0.85rem; font-weight: 600; color: #4a5568; margin: 0; }

.receipt-divider { text-align: center; color: #d4af37; font-size: 0.9rem; margin: 0.75rem 0; letter-spacing: 4px; }

.receipt-meta-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.6rem 1rem;
  margin-bottom: 1.25rem;
}

.receipt-badge { font-size: 0.75rem; font-weight: 800; color: #2b6cb0; letter-spacing: 1px; }
.receipt-no { font-family: monospace; font-weight: 700; color: #742a2a; font-size: 0.85rem; }

.receipt-body-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem 1.25rem;
  margin-bottom: 1.25rem;
}

.receipt-field { display: flex; flex-direction: column; gap: 0.2rem; }
.field-label { font-size: 0.75rem; font-weight: 600; color: #718096; }
.field-value { font-size: 0.92rem; font-weight: 600; color: #2d3748; }
.field-value.highlight { font-weight: 800; color: #1a202c; font-size: 1rem; }

.months-display {
  font-weight: 700;
  color: #2b6cb0;
  font-size: 0.9rem;
}

.category-pill {
  display: inline-block;
  background: #ebf8ff;
  color: #2b6cb0;
  padding: 0.2rem 0.6rem;
  border-radius: 20px;
  font-size: 0.82rem;
  font-weight: 700;
  width: fit-content;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 0.35rem;
}
.dot-green { background: #38a169; }
.dot-blue  { background: #3182ce; }
.dot-yellow{ background: #d69e2e; }

.receipt-amount-card {
  background: linear-gradient(135deg, #fffaf0 0%, #feebc8 100%);
  border: 1px dashed #d69e2e;
  border-radius: 12px;
  padding: 1.25rem;
  text-align: center;
  margin: 1.25rem 0;
}

.amount-label { font-size: 0.75rem; font-weight: 800; color: #744210; letter-spacing: 1px; }
.amount-val { font-size: 1.85rem; font-weight: 900; color: #742a2a; margin-top: 0.25rem; }
.amount-sub { font-size: 0.75rem; color: #744210; margin-top: 0.25rem; opacity: 0.8; }

.receipt-note {
  font-size: 0.85rem;
  color: #4a5568;
  background: #f7fafc;
  padding: 0.6rem 0.8rem;
  border-radius: 6px;
  margin-bottom: 1.25rem;
}

.receipt-footer-seal {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #edf2f7;
}

/* Stamp: image or fallback circle */
.stamp-img {
  width: 80px;
  height: 80px;
  object-fit: contain;
}

.seal-circle {
  width: 76px;
  height: 76px;
  border: 2px dashed #d4af37;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 800;
  color: #b7791f;
  text-align: center;
}

/* Signature: image or fallback line */
.sig-box { width: 160px; text-align: center; }

.sig-img {
  width: 160px;
  height: 48px;
  object-fit: contain;
  margin-bottom: 0.2rem;
}

.sig-line { border-bottom: 1px solid #718096; margin-bottom: 0.35rem; }
.sig-label { font-size: 0.72rem; color: #718096; font-weight: 600; }

.receipt-blessing {
  text-align: center;
  font-size: 0.75rem;
  color: #718096;
  font-style: italic;
  margin-top: 1.5rem;
}

/* Print Overrides */
@media print {
  body * { visibility: hidden; }
  .modal-overlay { position: static; background: none; padding: 0; }
  .receipt-modal-container { box-shadow: none; border: none; max-width: 100%; }
  .no-print { display: none !important; }
  #printable-receipt, #printable-receipt * { visibility: visible; }
  #printable-receipt {
    position: absolute;
    left: 0; top: 0;
    width: 100%;
    padding: 2cm;
  }
}
</style>
