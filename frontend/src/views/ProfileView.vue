<template>
  <div>
    <div class="page-header mb-3">
      <div>
        <h1 class="page-title">{{ t('profile.title') }}</h1>
        <p class="page-subtitle">{{ t('profile.subtitle') }}</p>
      </div>
    </div>

    <div class="card" style="max-width:580px;margin:0 auto;">
      <div class="card-body">
        <form @submit.prevent="handleSave">
          <div v-if="successMsg" class="alert alert-success mb-3">
            ✅ {{ successMsg }}
          </div>
          <div v-if="errorMsg" class="alert alert-danger mb-3">
            ⚠️ {{ errorMsg }}
          </div>

          <!-- Avatar Image Upload Preview -->
          <div class="form-group" style="text-align:center;margin-bottom:1.75rem;">
            <div style="display:inline-flex;flex-direction:column;align-items:center;gap:0.75rem;">
              <div class="profile-avatar-container">
                <img v-if="avatarPreview" :src="avatarPreview" class="profile-avatar-img" />
                <div v-else class="profile-avatar-placeholder">
                  {{ form.full_name ? form.full_name.charAt(0) : '👤' }}
                </div>
              </div>
              <label class="btn btn-ghost btn-sm" style="cursor:pointer;margin:0;">
                📷 {{ t('members.choosePhoto') }}
                <input type="file" accept="image/*" style="display:none;" @change="handleFileSelect" />
              </label>
            </div>
          </div>

          <!-- Full Name -->
          <div class="form-group mb-3">
            <label class="form-label">{{ t('common.name') }} *</label>
            <input
              v-model="form.full_name"
              type="text"
              class="form-control"
              :disabled="isMember"
              :style="isMember ? 'opacity:0.7;cursor:not-allowed;background:var(--bg-glass);' : ''"
              required
            />
            <small v-if="isMember" class="text-muted" style="display:block;margin-top:0.35rem;font-size:0.75rem;">
              🔒 {{ lang === 'en' ? 'Full name can only be changed by an administrator' : 'ስም ሊቀየር የሚችለው በአስተዳዳሪ ብቻ ነው' }}
            </small>
          </div>

          <!-- Phone Number -->
          <div class="form-group mb-3">
            <label class="form-label">{{ t('common.phone') }} *</label>
            <input v-model="form.phone" type="tel" class="form-control" required />
          </div>

          <!-- New Password -->
          <div class="form-group mb-4" style="margin-bottom:1.75rem;">
            <label class="form-label">{{ t('admins.newPassword') }}</label>
            <input
              v-model="form.password"
              type="password"
              class="form-control"
              :placeholder="t('admins.newPassword')"
            />
          </div>

          <!-- Submit Button Container with ample top margin spacing -->
          <div style="display:flex;justify-content:flex-end;gap:1rem;margin-top:1.75rem;">
            <button type="submit" class="btn btn-primary btn-lg w-full" :disabled="saving">
              <span v-if="saving" class="spinner spinner-sm"></span>
              {{ saving ? t('common.loading') : t('common.save') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { useLangStore } from '../stores/lang'
import { getAvatarUrl } from '../utils/avatar'

const { t } = useI18n()
const auth = useAuthStore()
const langStore = useLangStore()
const lang = computed(() => langStore.lang)

const isMember = computed(() => auth.user?.role === 'member')

const form = ref({ full_name: '', phone: '', password: '' })
const avatarFile = ref(null)
const avatarPreview = ref(null)
const saving = ref(false)
const successMsg = ref('')
const errorMsg = ref('')

onMounted(() => {
  if (auth.user) {
    form.value.full_name = auth.user.full_name || ''
    form.value.phone = auth.user.phone || ''
    avatarPreview.value = getAvatarUrl(auth.user.avatar_url)
  }
})

function handleFileSelect(event) {
  const file = event.target.files[0]
  if (!file) return
  avatarFile.value = file
  avatarPreview.value = URL.createObjectURL(file)
}

async function handleSave() {
  saving.value = false
  successMsg.value = ''
  errorMsg.value = ''

  saving.value = true
  try {
    const formData = new FormData()
    if (!isMember.value && form.value.full_name) {
      formData.append('full_name', form.value.full_name)
    }
    formData.append('phone', form.value.phone)
    if (form.value.password) {
      formData.append('password', form.value.password)
    }
    if (avatarFile.value) {
      formData.append('avatar', avatarFile.value)
    }

    const updatedUser = await auth.updateProfile(formData)
    avatarPreview.value = getAvatarUrl(updatedUser.avatar_url)
    form.value.password = ''
    successMsg.value = t('profile.savedSuccess')
  } catch (err) {
    errorMsg.value = err.response?.data?.error || t('common.error')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.profile-avatar-container {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: 3px solid var(--gold);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(212,175,55,0.15), rgba(139,26,26,0.15));
  box-shadow: 0 0 20px rgba(212,175,55,0.2);
}

.profile-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-avatar-placeholder {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--gold);
}
</style>
