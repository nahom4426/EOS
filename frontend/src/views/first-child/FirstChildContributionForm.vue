<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">💰 Record Contributions</h1>
        <p class="page-subtitle">Submit monthly dues for your family members</p>
      </div>
    </div>

    <div class="page-content">
      <div class="contribution-layout mb-3">
        <!-- Batch builder card -->
        <div class="card contribution-form-card">
          <div class="card-header">
            <h3 class="card-title">Add Family Member Entry</h3>
            <div v-if="baseRate" class="badge badge-gold">
              Base Rate: {{ formatCurrency(baseRate) }} / month
            </div>
          </div>
          <div class="card-body">
            <div v-if="formError" class="alert alert-danger mb-2">{{ formError }}</div>

            <!-- Member selector -->
            <div class="form-group" ref="dropdownRef">
              <label class="form-label">Family Member *</label>
              <div style="position:relative;">
                <input
                  v-model="memberSearchInput"
                  type="text"
                  class="form-control"
                  placeholder="Search siblings or select below..."
                  @focus="showDropdown = true"
                />
                <div v-if="showDropdown && (allSiblings.length || filteredSiblings.length)" class="member-dropdown multi-column-dropdown">
                  <!-- Select All option -->
                  <div
                    class="member-suggestion select-all-option"
                    :class="{ selected: isAllSelected, disabled: !availableSiblings.length }"
                    @click.stop="toggleSelectAll"
                  >
                    <div style="display:flex;align-items:center;gap:0.6rem;">
                      <input
                        type="checkbox"
                        :checked="isAllSelected"
                        :disabled="!availableSiblings.length"
                        style="width:16px;height:16px;cursor:pointer;"
                        @click.stop="toggleSelectAll"
                      />
                      <span style="font-weight:700;color:var(--gold, #d4af37);">✨ Select All Available Members</span>
                    </div>
                    <span class="badge badge-gold" style="font-size:0.7rem;">{{ availableSiblings.length }} available</span>
                  </div>

                  <div style="border-bottom: 1px solid var(--border-color, rgba(212, 175, 55, 0.2));"></div>

                  <!-- 2 or 3 Column Sibling Grid -->
                  <div class="dropdown-items-grid sibling-grid">
                    <div
                      v-for="m in filteredSiblings"
                      :key="m.id"
                      class="member-suggestion grid-item"
                      :class="{
                        selected: selectedMemberIds.includes(m.id),
                        disabled: isMemberInBatch(m.id)
                      }"
                      @click.stop="toggleSelectMember(m)"
                    >
                      <div style="display:flex;align-items:center;gap:0.5rem;flex:1;min-width:0;">
                        <input
                          type="checkbox"
                          :checked="selectedMemberIds.includes(m.id)"
                          :disabled="isMemberInBatch(m.id)"
                          style="width:16px;height:16px;cursor:pointer;flex-shrink:0;"
                          @click.stop="toggleSelectMember(m)"
                        />
                        <span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" :style="{ opacity: isMemberInBatch(m.id) ? 0.55 : 1 }">
                          {{ m.full_name }}
                        </span>
                      </div>
                      <span v-if="isMemberInBatch(m.id)" class="badge badge-warning" style="font-size:0.65rem;flex-shrink:0;">
                        In Batch
                      </span>
                      <span v-else class="text-muted item-phone" style="font-size:0.78rem;flex-shrink:0;">{{ m.phone }}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Selection status badge -->
              <div v-if="selectedMemberIds.length" class="mt-1 flex items-center">
                <span class="badge badge-success" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.4rem 0.75rem;font-size:0.85rem;">
                  <span v-if="isAllSelected">✓ All Available Members Selected ({{ selectedMemberIds.length }})</span>
                  <span v-else-if="selectedMemberIds.length > 1">✓ {{ selectedMemberIds.length }} Family Members Selected</span>
                  <span v-else>✓ {{ selectedMemberNames[0] }}</span>
                  <button
                    type="button"
                    style="background:none;border:none;color:currentColor;cursor:pointer;font-weight:bold;margin-left:0.4rem;"
                    @click.stop="clearSelection"
                    title="Clear selection"
                  >
                    ✕
                  </button>
                </span>
              </div>
            </div>

            <!-- Month multi-select dropdown -->
            <div class="form-group" ref="monthDropdownRef">
              <label class="form-label">Months Covered (Ethiopian Calendar) *</label>
              <div style="position:relative;">
                <div
                  class="form-control month-select-trigger"
                  :class="{ active: showMonthDropdown }"
                  @click="showMonthDropdown = !showMonthDropdown"
                >
                  <span v-if="!entryForm.months_covered.length" class="text-muted">
                    Select months covered...
                  </span>
                  <span v-else class="month-trigger-text">
                    {{ entryForm.months_covered.join(', ') }}
                  </span>
                  <span class="dropdown-arrow">▼</span>
                </div>

                <!-- Month dropdown menu (3 columns) -->
                <div v-if="showMonthDropdown" class="member-dropdown month-dropdown-menu multi-column-dropdown">
                  <!-- Select All Months -->
                  <div
                    class="member-suggestion select-all-option"
                    :class="{ selected: isAllMonthsSelected }"
                    @click.stop="toggleSelectAllMonths"
                  >
                    <div style="display:flex;align-items:center;gap:0.6rem;">
                      <input
                        type="checkbox"
                        :checked="isAllMonthsSelected"
                        style="width:16px;height:16px;cursor:pointer;"
                        @click.stop="toggleSelectAllMonths"
                      />
                      <span style="font-weight:700;color:var(--gold, #d4af37);">✨ Select All 13 Months</span>
                    </div>
                    <span class="badge badge-gold" style="font-size:0.7rem;">Full Year</span>
                  </div>

                  <div style="border-bottom: 1px solid var(--border-color, rgba(212, 175, 55, 0.2));"></div>

                  <!-- 3 Column Month Grid -->
                  <div class="dropdown-items-grid month-grid-3col">
                    <div
                      v-for="m in ETHIOPIAN_MONTHS"
                      :key="m"
                      class="member-suggestion grid-item"
                      :class="{ selected: entryForm.months_covered.includes(m) }"
                      @click.stop="toggleMonth(m)"
                    >
                      <div style="display:flex;align-items:center;gap:0.5rem;">
                        <input
                          type="checkbox"
                          :checked="entryForm.months_covered.includes(m)"
                          style="width:16px;height:16px;cursor:pointer;flex-shrink:0;"
                          @click.stop="toggleMonth(m)"
                        />
                        <span style="font-weight:600;">{{ m }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Selected month summary badge -->
              <div v-if="entryForm.months_covered.length" class="mt-1 flex items-center">
                <span class="badge badge-gold" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.35rem 0.75rem;font-size:0.82rem;">
                  <span>📅 {{ entryForm.months_covered.length }} month(s) selected</span>
                  <button
                    type="button"
                    style="background:none;border:none;color:currentColor;cursor:pointer;font-weight:bold;margin-left:0.3rem;"
                    @click.stop="entryForm.months_covered = []"
                    title="Clear months"
                  >
                    ✕
                  </button>
                </span>
              </div>
            </div>

            <!-- Amount with auto-suggest -->
            <div class="form-group">
              <label class="form-label">Amount (ETB) *</label>
              <div style="position:relative;">
                <input
                  v-model.number="entryForm.amount"
                  type="number"
                  step="0.01"
                  :min="minimumAmount"
                  class="form-control"
                  :class="{ 'input-error': amountBelowMin }"
                  :placeholder="`Minimum: ${minimumAmount} ETB`"
                />
              </div>
              <div v-if="entryForm.months_covered.length" class="amount-hint">
                <span v-if="amountBelowMin" class="text-danger">
                  ⚠️ Minimum is {{ formatCurrency(minimumAmount) }} ({{ entryForm.months_covered.length }} × {{ formatCurrency(baseRate) }})
                </span>
                <span v-else class="text-success">
                  ✅ Suggested: {{ formatCurrency(minimumAmount) }}
                </span>
                <button
                  v-if="entryForm.amount !== minimumAmount"
                  type="button"
                  class="btn btn-ghost btn-xs ml-2"
                  @click="entryForm.amount = minimumAmount"
                >
                  Use minimum
                </button>
              </div>
            </div>

            <!-- Note -->
            <div class="form-group">
              <label class="form-label">Note (optional)</label>
              <input v-model="entryForm.note" type="text" class="form-control" placeholder="e.g. Partial payment" />
            </div>

            <button
              class="btn btn-primary btn-add-batch"
              :disabled="!canAddEntry"
              @click="addEntry"
            >
              ＋ Add to Batch <span v-if="selectedMemberIds.length > 1">({{ selectedMemberIds.length }} entries)</span>
            </button>
          </div>
        </div>

        <!-- Batch queue -->
        <div class="card contribution-batch-card">
          <div class="card-header">
            <h3 class="card-title">📋 Submission Batch {{ batch.length ? `(${batch.length} entries)` : '' }}</h3>
            <div v-if="batch.length" class="badge badge-gold">Total: {{ formatCurrency(batchTotal) }} ETB</div>
          </div>

          <div v-if="!batch.length" class="card-body empty-batch-body">
            <div class="empty-batch-icon">📥</div>
            <div class="empty-batch-title">Batch Queue Empty</div>
            <div class="empty-batch-sub">Select family members & months to queue entries here before submitting.</div>
          </div>

          <div v-else class="card-body" style="padding:0;">
            <div v-for="(entry, idx) in batch" :key="idx" class="batch-row">
              <div style="flex:1;min-width:0;">
                <div style="font-weight:600;display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                  <span>{{ entry.member_name }}</span>
                  <span v-if="entry.note" class="badge badge-gold" style="font-size:0.65rem;text-transform:none;">
                    📝 {{ entry.note }}
                  </span>
                </div>
                <div class="text-muted" style="font-size:0.8rem;margin-top:0.15rem;">
                  {{ entry.months_covered.join(', ') }} ({{ entry.months_covered.length }} mo)
                </div>
              </div>
              <div style="font-weight:700;color:var(--gold);margin-right:0.5rem;font-size:0.95rem;">
                {{ formatCurrency(entry.amount) }}
              </div>
              <div style="display:flex;gap:0.35rem;align-items:center;">
                <button
                  class="btn btn-ghost btn-xs btn-icon"
                  @click="openEditEntry(idx)"
                  title="Edit entry"
                  style="width:30px;height:30px;font-size:0.85rem;"
                >
                  ✏️
                </button>
                <button
                  class="btn btn-danger btn-xs btn-icon"
                  @click="removeEntry(idx)"
                  title="Remove from batch"
                  style="width:30px;height:30px;font-size:0.85rem;"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          <div v-if="batch.length" class="card-footer" style="display:flex;justify-content:flex-end;gap:0.75rem;">
            <button class="btn btn-ghost" @click="clearBatch">Clear All</button>
            <button
              class="btn btn-primary btn-submit-batch"
              :disabled="submitting"
              @click="submitBatch"
            >
              <span v-if="submitting" class="spinner spinner-sm"></span>
              🚀 Submit Batch ({{ batch.length }} entries)
            </button>
          </div>
        </div>
      </div>

      <!-- Success feedback -->
      <div v-if="submittedBatch" class="card success-card">
        <div class="card-body" style="text-align:center;padding:2rem;">
          <div style="font-size:3rem;margin-bottom:1rem;">✅</div>
          <h3 style="color:var(--success);margin-bottom:0.5rem;">Batch Submitted Successfully!</h3>
          <p class="text-muted">Batch ID: <code>{{ submittedBatch.batch_id }}</code></p>
          <p class="text-muted">{{ submittedBatch.contributions.length }} contribution(s) sent to your Mini-Admin for verification.</p>
          <button class="btn btn-primary mt-2" @click="submittedBatch = null">Submit Another Batch</button>
        </div>
      </div>

      <!-- Edit Batch Entry Modal -->
      <Teleport to="body">
        <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
          <div class="modal" style="max-width:500px;">
            <div class="modal-header">
              <span class="modal-title">✏️ Edit Batch Entry for {{ editForm.member_name }}</span>
              <button class="btn btn-ghost btn-sm btn-icon" @click="showEditModal = false">✕</button>
            </div>
            <form @submit.prevent="saveEditEntry">
              <div class="modal-body" style="display:flex;flex-direction:column;gap:1.25rem;">
                <!-- Months selection dropdown -->
                <div class="form-group" ref="editMonthDropdownRef">
                  <label class="form-label">Months Covered *</label>
                  <div style="position:relative;">
                    <div
                      class="form-control month-select-trigger"
                      :class="{ active: showEditMonthDropdown }"
                      @click="showEditMonthDropdown = !showEditMonthDropdown"
                    >
                      <span v-if="!editForm.months_covered.length" class="text-muted">
                        Select months covered...
                      </span>
                      <span v-else class="month-trigger-text">
                        {{ editForm.months_covered.join(', ') }}
                      </span>
                      <span class="dropdown-arrow">▼</span>
                    </div>

                    <div v-if="showEditMonthDropdown" class="member-dropdown month-dropdown-menu multi-column-dropdown">
                      <div
                        class="member-suggestion select-all-option"
                        :class="{ selected: isAllEditMonthsSelected }"
                        @click.stop="toggleSelectAllEditMonths"
                      >
                        <div style="display:flex;align-items:center;gap:0.6rem;">
                          <input
                            type="checkbox"
                            :checked="isAllEditMonthsSelected"
                            style="width:16px;height:16px;cursor:pointer;"
                            @click.stop="toggleSelectAllEditMonths"
                          />
                          <span style="font-weight:700;color:var(--gold, #d4af37);">✨ Select All 13 Months</span>
                        </div>
                        <span class="badge badge-gold" style="font-size:0.7rem;">Full Year</span>
                      </div>

                      <div style="border-bottom: 1px solid var(--border-color, rgba(212, 175, 55, 0.2));"></div>

                      <!-- 3 Column Month Grid -->
                      <div class="dropdown-items-grid month-grid-3col">
                        <div
                          v-for="m in ETHIOPIAN_MONTHS"
                          :key="m"
                          class="member-suggestion grid-item"
                          :class="{ selected: editForm.months_covered.includes(m) }"
                          @click.stop="toggleEditMonth(m)"
                        >
                          <div style="display:flex;align-items:center;gap:0.5rem;">
                            <input
                              type="checkbox"
                              :checked="editForm.months_covered.includes(m)"
                              style="width:16px;height:16px;cursor:pointer;flex-shrink:0;"
                              @click.stop="toggleEditMonth(m)"
                            />
                            <span style="font-weight:600;">{{ m }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-if="editForm.months_covered.length" class="mt-1 flex items-center">
                    <span class="badge badge-gold" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.35rem 0.75rem;font-size:0.82rem;">
                      <span>📅 {{ editForm.months_covered.length }} month(s) selected</span>
                    </span>
                  </div>
                </div>

                <!-- Amount -->
                <div class="form-group">
                  <label class="form-label">Amount (ETB) *</label>
                  <input
                    v-model.number="editForm.amount"
                    type="number"
                    step="0.01"
                    :min="editMinimumAmount"
                    class="form-control"
                    required
                  />
                  <div v-if="editForm.months_covered.length" class="amount-hint">
                    <span class="text-success">✅ Minimum suggested: {{ formatCurrency(editMinimumAmount) }}</span>
                  </div>
                </div>

                <!-- Note -->
                <div class="form-group">
                  <label class="form-label">Note (optional)</label>
                  <input v-model="editForm.note" type="text" class="form-control" placeholder="e.g. Adjusted payment" />
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-ghost" @click="showEditModal = false">Cancel</button>
                <button
                  type="submit"
                  class="btn btn-primary"
                  :disabled="!editForm.months_covered.length || editForm.amount < editMinimumAmount"
                >
                  ✓ Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../../api/axios'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const route = useRoute()

const ETHIOPIAN_MONTHS = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas',
  'Tir', 'Yekatit', 'Megabit', 'Miyazya',
  'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'
]

const baseRate = ref(10.00)
const allSiblings = ref([])
const selectedMemberIds = ref([])
const memberSearchInput = ref('')
const showDropdown = ref(false)
const dropdownRef = ref(null)
const batch = ref([])
const formError = ref('')
const submitting = ref(false)
const submittedBatch = ref(null)

const entryForm = ref({
  months_covered: [],
  amount: 10.00,
  note: ''
})

// Duplicate member prevention in batch
const batchMemberIds = computed(() => new Set(batch.value.map(b => b.member_id)))

const availableSiblings = computed(() =>
  allSiblings.value.filter(s => !batchMemberIds.value.has(s.id))
)

const isAllSelected = computed(() =>
  availableSiblings.value.length > 0 && selectedMemberIds.value.length === availableSiblings.value.length
)

function isMemberInBatch(memberId) {
  return batchMemberIds.value.has(memberId)
}

const filteredSiblings = computed(() => {
  if (!memberSearchInput.value.trim()) return allSiblings.value
  const q = memberSearchInput.value.toLowerCase().trim()
  return allSiblings.value.filter(s =>
    s.full_name?.toLowerCase().includes(q) ||
    s.phone?.includes(q)
  )
})

const selectedMemberNames = computed(() => {
  return allSiblings.value
    .filter(s => selectedMemberIds.value.includes(s.id))
    .map(s => s.full_name)
})

const minimumAmount = computed(() => {
  const count = entryForm.value.months_covered.length
  return (count > 0 ? count : 1) * baseRate.value
})

const amountBelowMin = computed(() =>
  entryForm.value.months_covered.length > 0 && entryForm.value.amount < minimumAmount.value
)

const canAddEntry = computed(() =>
  selectedMemberIds.value.length > 0 &&
  entryForm.value.months_covered.length > 0 &&
  entryForm.value.amount >= minimumAmount.value
)

const batchTotal = computed(() =>
  batch.value.reduce((s, e) => s + e.amount, 0)
)

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedMemberIds.value = []
  } else {
    selectedMemberIds.value = availableSiblings.value.map(s => s.id)
  }
}

function toggleSelectMember(m) {
  if (isMemberInBatch(m.id)) return
  const idx = selectedMemberIds.value.indexOf(m.id)
  if (idx > -1) {
    selectedMemberIds.value.splice(idx, 1)
  } else {
    selectedMemberIds.value.push(m.id)
  }
}

function clearSelection() {
  selectedMemberIds.value = []
  memberSearchInput.value = ''
}

// Edit Batch Entry state
const showEditModal = ref(false)
const editingBatchIndex = ref(-1)
const editForm = ref({
  member_id: null,
  member_name: '',
  months_covered: [],
  amount: 10.00,
  note: ''
})

const editMinimumAmount = computed(() => {
  const count = editForm.value.months_covered.length
  return (count > 0 ? count : 1) * baseRate.value
})

function openEditEntry(idx) {
  editingBatchIndex.value = idx
  const entry = batch.value[idx]
  editForm.value = {
    member_id: entry.member_id,
    member_name: entry.member_name,
    months_covered: [...entry.months_covered],
    amount: entry.amount,
    note: entry.note || ''
  }
  showEditModal.value = true
}

function saveEditEntry() {
  if (editingBatchIndex.value < 0) return
  if (!editForm.value.months_covered.length || editForm.value.amount < editMinimumAmount.value) return

  batch.value[editingBatchIndex.value] = {
    ...batch.value[editingBatchIndex.value],
    months_covered: [...editForm.value.months_covered],
    amount: editForm.value.amount,
    note: editForm.value.note
  }

  showEditModal.value = false
  editingBatchIndex.value = -1
}

watch(() => editForm.value.months_covered, (newMonths, oldMonths) => {
  const count = newMonths.length
  const expectedMin = (count > 0 ? count : 1) * baseRate.value
  const oldMin = (oldMonths ? (oldMonths.length > 0 ? oldMonths.length : 1) : 1) * baseRate.value
  if (editForm.value.amount === 0 || editForm.value.amount === oldMin || editForm.value.amount < expectedMin) {
    editForm.value.amount = expectedMin
  }
}, { deep: true })

watch(() => entryForm.value.months_covered, (newMonths, oldMonths) => {
  const count = newMonths.length
  const expectedMin = (count > 0 ? count : 1) * baseRate.value
  const oldMin = (oldMonths ? (oldMonths.length > 0 ? oldMonths.length : 1) : 1) * baseRate.value
  
  if (entryForm.value.amount === 0 || entryForm.value.amount === oldMin || entryForm.value.amount < expectedMin) {
    entryForm.value.amount = expectedMin
  }
}, { deep: true })

function formatCurrency(v) {
  return Number(v).toLocaleString('en-ET', { minimumFractionDigits: 2 })
}

async function fetchSiblings() {
  try {
    const res = await api.get('/api/members', { params: { limit: 100 } })
    allSiblings.value = res.data.data || []
  } catch (e) {
    console.error(e)
  }
}

function addEntry() {
  formError.value = ''
  if (!canAddEntry.value) return

  const targetMembers = allSiblings.value.filter(s => selectedMemberIds.value.includes(s.id))
  targetMembers.forEach(m => {
    batch.value.push({
      member_id: m.id,
      member_name: m.full_name,
      months_covered: [...entryForm.value.months_covered],
      amount: entryForm.value.amount,
      note: entryForm.value.note
    })
  })

  // Reset form selection
  selectedMemberIds.value = []
  memberSearchInput.value = ''
  entryForm.value.months_covered = []
  entryForm.value.note = ''
  showDropdown.value = false
}

function removeEntry(idx) {
  batch.value.splice(idx, 1)
}

function clearBatch() {
  batch.value = []
}

async function submitBatch() {
  formError.value = ''
  submitting.value = true
  try {
    const entries = batch.value.map(e => ({
      member_id: e.member_id,
      months_covered: e.months_covered,
      amount: e.amount,
      note: e.note || undefined,
    }))
    const res = await api.post('/api/contributions', {
      entries,
      date_paid: new Date().toISOString().split('T')[0],
    })
    submittedBatch.value = res.data
    batch.value = []
  } catch (e) {
    formError.value = e.response?.data?.error || 'Submission failed. Please try again.'
  } finally {
    submitting.value = false
  }
}

const showMonthDropdown = ref(false)
const monthDropdownRef = ref(null)

const showEditMonthDropdown = ref(false)
const editMonthDropdownRef = ref(null)

function toggleMonth(m) {
  const idx = entryForm.value.months_covered.indexOf(m)
  if (idx > -1) {
    entryForm.value.months_covered.splice(idx, 1)
  } else {
    entryForm.value.months_covered.push(m)
  }
}

const isAllMonthsSelected = computed(() =>
  entryForm.value.months_covered.length === ETHIOPIAN_MONTHS.length
)

function toggleSelectAllMonths() {
  if (isAllMonthsSelected.value) {
    entryForm.value.months_covered = []
  } else {
    entryForm.value.months_covered = [...ETHIOPIAN_MONTHS]
  }
}

function toggleEditMonth(m) {
  const idx = editForm.value.months_covered.indexOf(m)
  if (idx > -1) {
    editForm.value.months_covered.splice(idx, 1)
  } else {
    editForm.value.months_covered.push(m)
  }
}

const isAllEditMonthsSelected = computed(() =>
  editForm.value.months_covered.length === ETHIOPIAN_MONTHS.length
)

function toggleSelectAllEditMonths() {
  if (isAllEditMonthsSelected.value) {
    editForm.value.months_covered = []
  } else {
    editForm.value.months_covered = [...ETHIOPIAN_MONTHS]
  }
}

function handleClickOutside(event) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    showDropdown.value = false
  }
  if (monthDropdownRef.value && !monthDropdownRef.value.contains(event.target)) {
    showMonthDropdown.value = false
  }
  if (editMonthDropdownRef.value && !editMonthDropdownRef.value.contains(event.target)) {
    showEditMonthDropdown.value = false
  }
}

onMounted(async () => {
  document.addEventListener('click', handleClickOutside)

  try {
    const res = await api.get('/api/settings/contribution-settings')
    baseRate.value = Number(res.data.default_monthly_contribution) || 10.00
  } catch (e) { console.error(e) }

  await fetchSiblings()

  // Initialize default amount to minimum base rate
  const count = entryForm.value.months_covered.length
  entryForm.value.amount = (count > 0 ? count : 1) * baseRate.value

  // Pre-select sibling if navigated from siblings page
  const preId = route.query.pre_member_id
  if (preId) {
    const pId = parseInt(preId)
    if (allSiblings.value.some(s => s.id === pId)) {
      selectedMemberIds.value = [pId]
    }
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.month-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  min-height: 42px;
  user-select: none;
}

.month-select-trigger:hover {
  border-color: var(--gold, #d4af37);
}

.month-select-trigger.active {
  border-color: var(--gold, #d4af37);
  box-shadow: 0 0 0 3px rgba(212,175,55,0.15);
}

.month-trigger-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
  color: var(--text-primary);
  max-width: calc(100% - 24px);
}

.dropdown-arrow {
  font-size: 0.72rem;
  color: var(--gold, #d4af37);
  margin-left: 0.5rem;
}

.month-dropdown-menu {
  max-height: 240px !important;
}

.amount-hint {
  font-size: 0.8rem;
  margin-top: 0.3rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.input-error {
  border-color: var(--danger, #e53e3e) !important;
}

.member-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-top: none;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  max-height: 340px;
  overflow-y: auto;
  z-index: 9999;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
  min-width: 100%;
}

.multi-column-dropdown {
  min-width: max(100%, 460px);
  max-width: min(540px, 90vw);
}

@media (max-width: 520px) {
  .multi-column-dropdown {
    min-width: 100%;
    max-width: 100%;
  }
}

.dropdown-items-grid {
  display: grid;
  padding: 0.5rem;
  gap: 0.35rem;
}

.sibling-grid {
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
}

.month-grid-3col {
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 640px) {
  .sibling-grid,
  .month-grid-3col {
    grid-template-columns: repeat(2, 1fr);
  }
}

.grid-item {
  border-radius: 8px;
  padding: 0.5rem 0.75rem !important;
  border: 1px solid transparent;
  transition: all 0.15s ease;
  user-select: none;
}

.grid-item:hover {
  background: var(--bg-glass-hover, rgba(212, 175, 55, 0.08));
  border-color: rgba(212, 175, 55, 0.2);
}

.grid-item.selected {
  background: rgba(212, 175, 55, 0.14) !important;
  border-color: var(--gold, #d4af37) !important;
}

.member-suggestion {
  padding: 0.65rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.15s;
}

.member-suggestion:hover { background: var(--bg-glass-hover, rgba(212, 175, 55, 0.08)); }

.member-suggestion.selected {
  background: rgba(212, 175, 55, 0.12);
}

.select-all-option {
  background: rgba(212, 175, 55, 0.06);
}

.select-all-option:hover {
  background: rgba(212, 175, 55, 0.14);
}

.member-suggestion.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: transparent !important;
}

.select-all-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.batch-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.15s;
}

.batch-row:last-child { border-bottom: none; }
.batch-row:hover { background: var(--bg-glass); }

.contribution-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  align-items: start;
  width: 100%;
}

@media (min-width: 992px) {
  .contribution-layout {
    grid-template-columns: 1fr 1fr;
  }
}

.contribution-form-card {
  position: relative;
  z-index: 50;
}

.contribution-batch-card {
  position: relative;
  z-index: 1;
}

.btn-add-batch {
  padding: 0.75rem 1.6rem !important;
  font-size: 0.92rem;
  font-weight: 700;
  border-radius: 10px;
  margin-top: 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 4px 14px rgba(212, 175, 55, 0.25);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-add-batch:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(212, 175, 55, 0.4);
}

.btn-submit-batch {
  padding: 0.75rem 1.6rem !important;
  font-size: 0.92rem;
  font-weight: 700;
  border-radius: 10px;
  box-shadow: 0 4px 14px rgba(212, 175, 55, 0.25);
}

.btn-submit-batch:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(212, 175, 55, 0.4);
}

.empty-batch-body {
  padding: 3.5rem 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-batch-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  opacity: 0.85;
}

.empty-batch-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.35rem;
}

.empty-batch-sub {
  font-size: 0.82rem;
  color: var(--text-muted);
  max-width: 280px;
  line-height: 1.5;
}

.success-card {
  border: 1px solid var(--success, #38a169);
  background: rgba(56,161,105,0.05);
}

.ml-2 { margin-left: 0.5rem; }
</style>
