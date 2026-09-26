<template>
  <div class="asset-uploader">
    <div class="upload-tabs">
      <button class="upload-tab" :class="{ active: mode === 'file' }" @click="mode = 'file'">📁 Upload File</button>
      <button class="upload-tab" :class="{ active: mode === 'camera' }" @click="startCamera">📷 Capture</button>
    </div>

    <!-- File upload -->
    <div v-if="mode === 'file'" class="upload-area">
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        style="display:none;"
        @change="onFileSelected"
      />
      <div class="drop-zone" @click="fileInput?.click()" @dragover.prevent @drop.prevent="onDrop">
        <span style="font-size:1.5rem;">📁</span>
        <span>Click or drag image here</span>
        <span class="text-muted" style="font-size:0.78rem;">PNG, JPG, GIF — max 5MB</span>
      </div>
      <div v-if="preview" class="preview-wrap">
        <img :src="preview" class="preview-img" />
        <button class="btn btn-primary btn-sm" @click="uploadFile" :disabled="uploading">
          <span v-if="uploading" class="spinner spinner-sm"></span>
          ⬆️ {{ label }}
        </button>
      </div>
    </div>

    <!-- Camera capture -->
    <div v-if="mode === 'camera'" class="camera-area">
      <video v-if="cameraActive" ref="videoEl" autoplay playsinline class="camera-preview"></video>
      <canvas ref="canvasEl" style="display:none;"></canvas>

      <div v-if="capturedImage" class="preview-wrap">
        <img :src="capturedImage" class="preview-img" />
        <div style="display:flex;gap:0.5rem;">
          <button class="btn btn-ghost btn-sm" @click="retakePhoto">🔄 Retake</button>
          <button class="btn btn-primary btn-sm" @click="uploadCapture" :disabled="uploading">
            <span v-if="uploading" class="spinner spinner-sm"></span>
            ⬆️ Use Photo
          </button>
        </div>
      </div>

      <div v-if="cameraActive && !capturedImage" class="camera-controls">
        <button class="btn btn-primary" @click="capturePhoto">📸 Capture</button>
        <button class="btn btn-ghost btn-sm" @click="stopCamera">Cancel</button>
      </div>
    </div>

    <div v-if="successMsg" class="alert alert-success mt-1">✅ {{ successMsg }}</div>
    <div v-if="errorMsg" class="alert alert-danger mt-1">{{ errorMsg }}</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import api from '../api/axios'

const props = defineProps({
  assetType: { type: String, required: true }, // 'church_stamp' | 'authorized_signature'
  label: { type: String, default: 'Upload' }
})

const emit = defineEmits(['uploaded'])

const mode = ref('file')
const fileInput = ref(null)
const videoEl = ref(null)
const canvasEl = ref(null)
const preview = ref(null)
const selectedFile = ref(null)
const capturedImage = ref(null)
const cameraActive = ref(false)
const uploading = ref(false)
const successMsg = ref('')
const errorMsg = ref('')
let stream = null

/**
 * Helper to compress and downscale an image (file, blob, or data URL)
 * to a maximum width of 600px at 0.8 JPEG quality.
 */
function compressImage(source, maxWidth = 600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let width = img.width
      let height = img.height
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('Failed to load image for compression'))

    if (typeof source === 'string') {
      img.src = source
    } else if (source instanceof File || source instanceof Blob) {
      const reader = new FileReader()
      reader.onload = (e) => { img.src = e.target.result }
      reader.onerror = (e) => reject(e)
      reader.readAsDataURL(source)
    } else {
      reject(new Error('Invalid image source'))
    }
  })
}

async function processAndSetFile(file) {
  if (!file || !file.type.startsWith('image/')) return
  errorMsg.value = ''
  try {
    const compressed = await compressImage(file, 600, 0.8)
    preview.value = compressed
    selectedFile.value = compressed
  } catch (e) {
    errorMsg.value = 'Failed to process image'
  }
}

function onFileSelected(e) {
  const file = e.target.files[0]
  if (file) processAndSetFile(file)
}

function onDrop(e) {
  const file = e.dataTransfer.files[0]
  if (file) processAndSetFile(file)
}

async function uploadFile() {
  if (!selectedFile.value) return
  uploading.value = true
  successMsg.value = ''
  errorMsg.value = ''
  try {
    const base64 = selectedFile.value.replace(/^data:image\/\w+;base64,/, '')
    const res = await api.post('/api/settings/assets', {
      asset_type: props.assetType,
      base64,
      mimetype: 'image/jpeg'
    })
    successMsg.value = `Uploaded successfully`
    emit('uploaded', res.data.url)
    preview.value = null
    selectedFile.value = null
  } catch (e) {
    errorMsg.value = e.response?.data?.error || 'Upload failed'
  } finally {
    uploading.value = false
  }
}

async function startCamera() {
  mode.value = 'camera'
  successMsg.value = ''
  errorMsg.value = ''
  capturedImage.value = null
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true })
    cameraActive.value = true
    await new Promise(r => setTimeout(r, 100))
    if (videoEl.value) videoEl.value.srcObject = stream
  } catch (e) {
    errorMsg.value = 'Camera access denied or unavailable'
    mode.value = 'file'
  }
}

async function capturePhoto() {
  if (!videoEl.value || !canvasEl.value) return
  const video = videoEl.value
  const canvas = canvasEl.value
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  canvas.getContext('2d').drawImage(video, 0, 0)
  const rawDataUrl = canvas.toDataURL('image/png')
  stopCamera()
  try {
    capturedImage.value = await compressImage(rawDataUrl, 600, 0.8)
  } catch (e) {
    capturedImage.value = rawDataUrl
  }
}

function retakePhoto() {
  capturedImage.value = null
  startCamera()
}

function stopCamera() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
  cameraActive.value = false
}

async function uploadCapture() {
  if (!capturedImage.value) return
  uploading.value = true
  successMsg.value = ''
  errorMsg.value = ''
  try {
    const base64 = capturedImage.value.replace(/^data:image\/\w+;base64,/, '')
    const res = await api.post('/api/settings/assets', {
      asset_type: props.assetType,
      base64,
      mimetype: 'image/jpeg'
    })
    successMsg.value = 'Photo uploaded successfully'
    emit('uploaded', res.data.url)
    capturedImage.value = null
  } catch (e) {
    errorMsg.value = e.response?.data?.error || 'Upload failed'
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.asset-uploader { display: flex; flex-direction: column; gap: 0.75rem; }

.upload-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border-color); margin-bottom: 0.75rem; }

.upload-tab {
  padding: 0.5rem 1rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s;
}

.upload-tab.active { color: var(--gold); border-bottom-color: var(--gold); }

.drop-zone {
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  transition: border-color 0.2s;
  font-size: 0.875rem;
}

.drop-zone:hover { border-color: var(--gold); }

.preview-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.preview-img {
  max-width: 200px;
  max-height: 150px;
  object-fit: contain;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.25rem;
  background: #fff;
}

.camera-preview {
  width: 100%;
  max-width: 360px;
  border-radius: 8px;
  background: #000;
}

.camera-area { display: flex; flex-direction: column; gap: 0.75rem; }

.camera-controls { display: flex; gap: 0.75rem; align-items: center; }

.mt-1 { margin-top: 0.5rem; }
</style>
