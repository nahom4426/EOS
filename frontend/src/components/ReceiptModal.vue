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
            <div class="receipt-emblem">✝️</div>
            <div class="receipt-church-titles">
              <h2>የኢትዮጵያ ኦርቶዶክስ ተዋሕዶ ቤተ ክርስቲያን</h2>
              <h3>Ethiopian Orthodox Tewahedo Church</h3>
              <p class="receipt-branch-name">{{ contribution?.branch_name || 'Church Branch' }}</p>
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

            <div class="receipt-field">
              <span class="field-label">Contribution Category / ዓይነት፡</span>
              <span class="field-value category-pill">{{ contribution?.category || 'Monthly Dues' }}</span>
            </div>

            <div class="receipt-field">
              <span class="field-label">Month Covered / የክፍያ ወር፡</span>
              <span class="field-value">{{ formatMonth(contribution?.month_covered) }}</span>
            </div>

            <div class="receipt-field">
              <span class="field-label">Date Paid / ክፍያ የተፈጸመበት ቀን፡</span>
              <span class="field-value">{{ formatDate(contribution?.date_paid) }}</span>
            </div>

            <div class="receipt-field" v-if="contribution?.recorded_by_name">
              <span class="field-label">Recorded By / ተቀባይ፡</span>
              <span class="field-value">{{ contribution?.recorded_by_name }}</span>
            </div>
          </div>

          <!-- Amount Box -->
          <div class="receipt-amount-card">
            <div class="amount-label">AMOUNT PAID / የተከፈለው መጠን</div>
            <div class="amount-val">{{ formatCurrency(contribution?.amount) }} ETB</div>
          </div>

          <div v-if="contribution?.note" class="receipt-note">
            <strong>Note / ማስታወሻ:</strong> {{ contribution?.note }}
          </div>

          <!-- Footer Seal -->
          <div class="receipt-footer-seal">
            <div class="seal-box">
              <div class="seal-circle">SEAL / ማኅተም</div>
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
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
const props = defineProps({
  show: { type: Boolean, default: false },
  contribution: { type: Object, default: null }
});

defineEmits(['close']);

function formatCurrency(val) {
  if (val === undefined || val === null) return '0.00';
  return Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatMonth(dateStr) {
  if (!dateStr) return 'N/A';
  const parts = String(dateStr).split('-');
  if (parts.length < 2) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[monthIdx] || parts[1]} ${year}`;
}

function printReceipt() {
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

.receipt-emblem {
  font-size: 2.75rem;
  color: #d4af37;
}

.receipt-church-titles h2 {
  font-size: 1.15rem;
  font-weight: 800;
  color: #742a2a;
  margin: 0;
}

.receipt-church-titles h3 {
  font-size: 0.95rem;
  font-weight: 700;
  color: #2b6cb0;
  margin: 0.2rem 0;
}

.receipt-branch-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #4a5568;
  margin: 0;
}

.receipt-divider {
  text-align: center;
  color: #d4af37;
  font-size: 0.9rem;
  margin: 0.75rem 0;
  letter-spacing: 4px;
}

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

.receipt-badge {
  font-size: 0.75rem;
  font-weight: 800;
  color: #2b6cb0;
  letter-spacing: 1px;
}

.receipt-no {
  font-family: monospace;
  font-weight: 700;
  color: #742a2a;
  font-size: 0.85rem;
}

.receipt-body-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem 1.25rem;
  margin-bottom: 1.25rem;
}

.receipt-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.field-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #718096;
}

.field-value {
  font-size: 0.92rem;
  font-weight: 600;
  color: #2d3748;
}

.field-value.highlight {
  font-weight: 800;
  color: #1a202c;
  font-size: 1rem;
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

.receipt-amount-card {
  background: linear-gradient(135deg, #fffaf0 0%, #feebc8 100%);
  border: 1px dashed #d69e2e;
  border-radius: 12px;
  padding: 1.25rem;
  text-align: center;
  margin: 1.25rem 0;
}

.amount-label {
  font-size: 0.75rem;
  font-weight: 800;
  color: #744210;
  letter-spacing: 1px;
}

.amount-val {
  font-size: 1.85rem;
  font-weight: 900;
  color: #742a2a;
  margin-top: 0.25rem;
}

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

.sig-box {
  width: 160px;
  text-align: center;
}

.sig-line {
  border-bottom: 1px solid #718096;
  margin-bottom: 0.35rem;
}

.sig-label {
  font-size: 0.72rem;
  color: #718096;
  font-weight: 600;
}

.receipt-blessing {
  text-align: center;
  font-size: 0.75rem;
  color: #718096;
  font-style: italic;
  margin-top: 1.5rem;
}

/* Print Overrides */
@media print {
  body * {
    visibility: hidden;
  }
  .modal-overlay {
    position: static;
    background: none;
    padding: 0;
  }
  .receipt-modal-container {
    box-shadow: none;
    border: none;
    max-width: 100%;
  }
  .no-print {
    display: none !important;
  }
  #printable-receipt, #printable-receipt * {
    visibility: visible;
  }
  #printable-receipt {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    padding: 2cm;
  }
}
</style>
