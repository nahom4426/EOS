<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">⚙️ System Settings</h1>
        <p class="page-subtitle">Configure contribution fees, stamps, and signatures</p>
      </div>
    </div>

    <div class="page-content">
      <!-- Tab bar -->
      <div class="settings-tabs mb-3">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="settings-tab"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.icon }} {{ tab.label }}
        </button>
      </div>

      <!-- ── Tab 1: Contribution Fee ── -->
      <div v-if="activeTab === 'fee'" class="card">
        <div class="card-header">
          <h3 class="card-title">💰 Default Monthly Contribution Fee</h3>
        </div>
        <div class="card-body">
          <p class="text-muted mb-2">
            This is the minimum base rate used to calculate multi-month contributions.
            <br><strong>Minimum Amount = Months Selected × This Rate</strong>
          </p>
          <div class="form-group" style="max-width:300px;">
            <label class="form-label">Fee Amount (ETB)</label>
            <input
              v-model.number="feeForm.amount"
              type="number"
              step="0.50"
              min="1"
              class="form-control"
            />
          </div>
          <div v-if="feeMsg" class="alert" :class="feeMsgType === 'success' ? 'alert-success' : 'alert-danger'">
            {{ feeMsg }}
          </div>
          <button class="btn btn-primary" :disabled="savingFee" @click="saveFee">
            <span v-if="savingFee" class="spinner spinner-sm"></span>
            💾 Save Fee
          </button>
        </div>
      </div>

      <!-- ── Tab 2: Church Stamp ── -->
      <div v-if="activeTab === 'stamp'" class="card">
        <div class="card-header">
          <h3 class="card-title">🔏 Church Stamp Image</h3>
        </div>
        <div class="card-body">
          <p class="text-muted mb-2">
            This image will appear on the left side of printed receipts.
            Upload a transparent PNG for best results.
          </p>

          <!-- Current stamp preview -->
          <div v-if="settings.church_stamp_url" class="asset-preview mb-2">
            <img :src="settings.church_stamp_url" alt="Church Stamp" class="asset-img" />
            <span class="text-muted" style="font-size:0.8rem;">Current stamp</span>
          </div>
          <div v-else class="asset-placeholder mb-2">No stamp uploaded</div>

          <AssetUploader
            asset-type="church_stamp"
            label="Upload Stamp"
            @uploaded="onAssetUploaded('church_stamp', $event)"
          />
        </div>
      </div>

      <!-- ── Tab 3: Signature ── -->
      <div v-if="activeTab === 'signature'" class="card">
        <div class="card-header">
          <h3 class="card-title">✍️ Authorized Signature Image</h3>
        </div>
        <div class="card-body">
          <p class="text-muted mb-2">
            This image will appear on the right side of printed receipts above the "Authorized Signature" label.
          </p>

          <div v-if="settings.authorized_signature_url" class="asset-preview mb-2">
            <img :src="settings.authorized_signature_url" alt="Signature" class="asset-img sig-img" />
            <span class="text-muted" style="font-size:0.8rem;">Current signature</span>
          </div>
          <div v-else class="asset-placeholder mb-2">No signature uploaded</div>

          <AssetUploader
            asset-type="authorized_signature"
            label="Upload Signature"
            @uploaded="onAssetUploaded('authorized_signature', $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, defineAsyncComponent } from 'vue'
import api from '../../api/axios'

// Lazy-load sub-component
const AssetUploader = defineAsyncComponent(() => import('../../components/AssetUploader.vue'))

const tabs = [
  { id: 'fee',       icon: '💰', label: 'Contribution Fee' },
  { id: 'stamp',     icon: '🔏', label: 'Church Stamp' },
  { id: 'signature', icon: '✍️', label: 'Signature' },
]

const activeTab = ref('fee')
const settings = ref({ default_monthly_contribution: 10, church_stamp_url: '', authorized_signature_url: '' })

const feeForm = ref({ amount: 10 })
const savingFee = ref(false)
const feeMsg = ref('')
const feeMsgType = ref('success')

async function loadSettings() {
  try {
    const res = await api.get('/api/settings/contribution-settings')
    settings.value = res.data
    feeForm.value.amount = res.data.default_monthly_contribution
  } catch (e) { console.error(e) }
}

async function saveFee() {
  feeMsg.value = ''
  savingFee.value = true
  try {
    await api.put('/api/settings/contribution-fee', { amount: feeForm.value.amount })
    feeMsg.value = `Fee updated to ${feeForm.value.amount} ETB`
    feeMsgType.value = 'success'
    await loadSettings()
  } catch (e) {
    feeMsg.value = e.response?.data?.error || 'Failed to save fee'
    feeMsgType.value = 'error'
  } finally {
    savingFee.value = false
  }
}

function onAssetUploaded(type, url) {
  if (type === 'church_stamp') settings.value.church_stamp_url = url
  if (type === 'authorized_signature') settings.value.authorized_signature_url = url
}

onMounted(() => loadSettings())
</script>

<style scoped>
.settings-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border-color);
}

.settings-tab {
  padding: 0.75rem 1.25rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.settings-tab:hover { color: var(--gold); }

.settings-tab.active {
  color: var(--gold);
  border-bottom-color: var(--gold);
}

.asset-preview {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.asset-img {
  width: 100px;
  height: 100px;
  object-fit: contain;
  border: 1px dashed var(--border-color);
  border-radius: 8px;
  padding: 0.5rem;
  background: #fff;
}

.sig-img {
  width: 180px;
  height: 80px;
}

.asset-placeholder {
  font-size: 0.85rem;
  color: var(--text-muted);
  border: 1px dashed var(--border-color);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
  width: fit-content;
}

.mb-2 { margin-bottom: 0.75rem; }
</style>
