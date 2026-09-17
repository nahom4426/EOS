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
  let audioCtx = null
  let masterGain = null
  let musicTimer = null
  const begenaScale = [146.83, 164.81, 196.00, 220.00, 261.63, 293.66, 329.63, 392.00]

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

  function initAudioCtx() {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext
      audioCtx = new AudioCtxClass()
      masterGain = audioCtx.createGain()
      masterGain.gain.setValueAtTime(0.18, audioCtx.currentTime)
      masterGain.connect(audioCtx.destination)
    }
  }

  function playBegenaNote(freq, duration = 2.5) {
    if (!audioCtx || audioCtx.state === 'closed') return
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    const filter = audioCtx.createBiquadFilter()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1200, audioCtx.currentTime)
    filter.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + duration)

    const now = audioCtx.currentTime
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.35, now + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(masterGain)

    osc.start(now)
    osc.stop(now + duration)
  }

  function startBegenaLoop() {
    initAudioCtx()
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }

    let step = 0
    const arpeggio = [0, 2, 4, 3, 5, 2, 1, 4, 0, 3, 2, 5]

    function tick() {
      if (!isMusicPlaying.value) return
      const index = arpeggio[step % arpeggio.length]
      const freq = begenaScale[index]
      playBegenaNote(freq, 2.8)

      if (step % 4 === 0) {
        playBegenaNote(begenaScale[0] / 2, 4.0)
      }

      step++
      musicTimer = setTimeout(tick, 650)
    }

    tick()
  }

  function startPlayback() {
    if (!isMusicPlaying.value) return

    const trackType = audioSetting.value.track
    const customUrl = audioSetting.value.custom_url || '/assets/audio/orthodox_classical.mp3'

    if (trackType === 'custom_audio' || trackType === 'custom_url' || customUrl) {
      if (!audioElem || audioElem.src !== window.location.origin + customUrl) {
        if (audioElem) audioElem.pause()
        audioElem = new Audio(customUrl)
        audioElem.loop = true
        audioElem.volume = 0.5
      }

      audioElem.play().then(() => {
        isMusicPlaying.value = true
      }).catch(err => {
        console.log('Audio playback waiting for user click:', err.message)
      })
    } else {
      startBegenaLoop()
    }
  }

  function stopPlayback() {
    if (audioElem) {
      audioElem.pause()
      audioElem = null
    }
    if (musicTimer) {
      clearTimeout(musicTimer)
      musicTimer = null
    }
    if (audioCtx && audioCtx.state === 'running') {
      audioCtx.suspend()
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
