<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('branches.title') }}</h1>
        <p class="page-subtitle">{{ t('superadmin.totalBranches') }}: {{ pagination.total }}</p>
      </div>
      <button class="btn btn-primary" @click="openModal()">
        ＋ {{ t('branches.addBranch') }}
      </button>
    </div>

    <div class="page-content">
      <div class="card">
        <div class="card-body" style="padding:0;">
          <div v-if="loading" class="loading-overlay"><div class="spinner"></div></div>
          <div v-else-if="!branches.length" class="empty-state">
            <div class="empty-icon">🏛️</div>
            <div class="empty-text">{{ t('common.noData') }}</div>
          </div>
          <div v-else>
            <div class="table-wrapper" style="border:none;border-radius:0;">
              <table class="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{{ t('branches.branchName') }}</th>
                    <th>{{ t('common.location') }}</th>
                    <th>{{ t('branches.members') }}</th>
                    <th>{{ t('branches.admins') }}</th>
                    <th>{{ t('branches.createdAt') }}</th>
                    <th>{{ t('common.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(b, i) in branches" :key="b.id">
                    <td class="text-muted" style="font-size:0.8rem;">{{ (pagination.page - 1) * pagination.limit + i + 1 }}</td>
                    <td><span style="font-weight:600;">{{ b.name }}</span></td>
                    <td class="text-muted">{{ b.location || t('branches.noLocation') }}</td>
                    <td><span class="badge badge-info">{{ b.member_count }}</span></td>
                    <td><span class="badge badge-gold">{{ b.admin_count }}</span></td>
                    <td class="text-muted" style="font-size:0.8rem;">{{ formatDate(b.created_at) }}</td>
                    <td>
                      <div class="flex gap-1">
                        <button class="btn btn-ghost btn-sm btn-icon" @click="openModal(b)" title="Edit">✏️</button>
                        <button class="btn btn-danger btn-sm btn-icon" @click="confirmDelete(b)" title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div class="card-footer flex justify-between items-center">
              <span class="text-muted" style="font-size:0.8rem;">
                {{ t('common.page') }} {{ pagination.page }} {{ t('common.of') }} {{ pagination.pages }}
              </span>
              <div class="pagination">
                <button class="pagination-btn" :disabled="pagination.page <= 1" @click="fetchBranches(pagination.page - 1)">‹</button>
                <button
                  v-for="p in visiblePages" :key="p"
                  class="pagination-btn"
                  :class="{ active: p === pagination.page }"
                  @click="fetchBranches(p)"
                >{{ p }}</button>
                <button class="pagination-btn" :disabled="pagination.page >= pagination.pages" @click="fetchBranches(pagination.page + 1)">›</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">{{ editing ? t('branches.editBranch') : t('branches.addBranch') }}</span>
            <button class="btn btn-ghost btn-sm btn-icon" @click="showModal = false">✕</button>
          </div>
          <form @submit.prevent="saveBranch">
            <div class="modal-body" style="display:flex;flex-direction:column;gap:1rem;">
              <div v-if="formError" class="alert alert-danger">{{ formError }}</div>
              <div class="form-group">
                <label class="form-label">{{ t('branches.branchName') }} *</label>
                <input v-model="form.name" type="text" class="form-control" required />
              </div>
              <div class="form-group">
                <label class="form-label">{{ t('common.location') }}</label>
                <input v-model="form.location" type="text" class="form-control" />
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-ghost" @click="showModal = false">{{ t('common.cancel') }}</button>
              <button type="submit" class="btn btn-primary" :disabled="saving">
                <span v-if="saving" class="spinner spinner-sm"></span>
                {{ t('common.save') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete confirm -->
    <Teleport to="body">
      <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
        <div class="modal" style="max-width:380px;">
          <div class="modal-body" style="text-align:center;padding:2rem;">
            <div style="font-size:2.5rem;margin-bottom:1rem;">⚠️</div>
            <h3>{{ t('common.deleteConfirm') }}</h3>
            <p class="text-muted mt-1" style="font-size:0.875rem;">{{ deleteTarget?.name }}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="deleteTarget = null">{{ t('common.cancel') }}</button>
            <button class="btn btn-danger" @click="deleteBranch" :disabled="saving">
              <span v-if="saving" class="spinner spinner-sm"></span>
              {{ t('common.delete') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../../api/axios'

const { t } = useI18n()
const branches = ref([])
const loading = ref(false)
const saving = ref(false)
const showModal = ref(false)
const editing = ref(null)
const deleteTarget = ref(null)
const formError = ref('')

const form = ref({ name: '', location: '' })
const pagination = ref({ total: 0, page: 1, limit: 15, pages: 1 })

const visiblePages = computed(() => {
  const pages = []
  const { page, pages: total } = pagination.value
  const start = Math.max(1, page - 2)
  const end = Math.min(total, page + 2)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

function openModal(branch = null) {
  editing.value = branch
  form.value = branch ? { name: branch.name, location: branch.location || '' } : { name: '', location: '' }
  formError.value = ''
  showModal.value = true
}

function confirmDelete(branch) { deleteTarget.value = branch }

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

async function fetchBranches(page = 1) {
  loading.value = true
  try {
    const res = await api.get('/api/branches', { params: { page, limit: 15 } })
    // Branches API returns array — handle pagination client-side for simplicity
    branches.value = res.data
    pagination.value = { total: res.data.length, page: 1, limit: 15, pages: 1 }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function saveBranch() {
  formError.value = ''
  saving.value = true
  try {
    if (editing.value) {
      await api.put(`/api/branches/${editing.value.id}`, form.value)
    } else {
      await api.post('/api/branches', form.value)
    }
    showModal.value = false
    fetchBranches()
  } catch (e) {
    formError.value = e.response?.data?.error || t('common.error')
  } finally {
    saving.value = false
  }
}

async function deleteBranch() {
  saving.value = true
  try {
    await api.delete(`/api/branches/${deleteTarget.value.id}`)
    deleteTarget.value = null
    fetchBranches()
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}

onMounted(() => fetchBranches())
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
