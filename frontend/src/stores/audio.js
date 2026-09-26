import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../api/axios'

export const useAudioStore = defineStore('audio', () => {
  const isMusicPlaying = ref(false)
  const audioSetting = ref({
    track: 'custom_audio',
    custom_url: '/assets/audio/orthodox_classical.mp3',
  })

  let audioElem = null

  async function fetchSetting() {
    try {
      const res = await api.get('/api/settings/login-classical')
      if (res.data) {
        audioSetting.value = res.data
      }
    } catch (e) {
      console.warn('Using default classical audio setting:', e)
    }
  }

  function getAudioUrl() {
    const track = audioSetting.value.track
    const customUrl = audioSetting.value.custom_url

    if (track === 'begena_synthesizer') {
      // Replaced: begena synthesizer now plays a real MP3
      return '/assets/audio/orthodox_begena.mp3'
    }
    return customUrl || '/assets/audio/orthodox_classical.mp3'
  }

  function startPlayback() {
    if (!isMusicPlaying.value) return

    const url = getAudioUrl()

    const isSameSource = audioElem && (audioElem.src === url || audioElem.src === window.location.origin + url)

    if (!isSameSource) {
      if (audioElem) audioElem.pause()
      audioElem = new Audio(url)
      audioElem.loop = true
      audioElem.volume = 0.5
    }

    audioElem.play().then(() => {
      isMusicPlaying.value = true
    }).catch(err => {
      console.log('Audio playback waiting for user click:', err.message)
    })
  }

  function stopPlayback() {
    if (audioElem) {
      audioElem.pause()
      audioElem = null
    }
  }

  function toggleMusic() {
    isMusicPlaying.value = !isMusicPlaying.value
    if (isMusicPlaying.value) {
      startPlayback()
    } else {
      stopPlayback()
    }
  }

  function updateSettingAndPlay(newSetting) {
    stopPlayback()
    if (newSetting) {
      audioSetting.value = { ...newSetting }
    }
    isMusicPlaying.value = true
    startPlayback()
  }

  function previewTrack(trackSetting) {
    stopPlayback()
    const origSetting = { ...audioSetting.value }
    if (trackSetting) {
      audioSetting.value = { ...trackSetting }
    }
    isMusicPlaying.value = true
    startPlayback()
    return () => {
      stopPlayback()
      audioSetting.value = origSetting
    }
  }

  async function initForPage(isLogin = false) {
    await fetchSetting()
    if (isLogin) {
      isMusicPlaying.value = true
      startPlayback()
    } else {
      // Internal pages default to muted unless already playing
      if (!isMusicPlaying.value) {
        stopPlayback()
      }
    }
  }

  return {
    isMusicPlaying,
    audioSetting,
    fetchSetting,
    startPlayback,
    stopPlayback,
    toggleMusic,
    updateSettingAndPlay,
    previewTrack,
    initForPage,
  }
})
