import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Track, EqProfile } from '../api/types'
import {
  trackStreamUrl, trackCoverUrl, getPlaybackState, savePlaybackState, getTracksByIds,
  logHistory, likeTrack, unlikeTrack, listEqProfiles, createEqProfile,
  deleteEqProfile, setActiveEqProfile, setActiveEqPreset, listRadioTracks,
} from '../api'
import { buildEqChain, EQ_PRESET_BANDS, type EqChain, type EqPresetId } from './equalizer'
import { useAuth } from '../auth/AuthContext'

type Repeat = 'off' | 'track' | 'queue'

interface PlayerContextValue {
  queue: Track[]
  currentIndex: number | null
  currentTrack: Track | null
  playing: boolean
  currentTime: number
  duration: number
  volume: number
  shuffle: boolean
  repeat: Repeat
  radioMode: boolean
  eqProfiles: EqProfile[]
  activeEqLabel: string | null
  activeBands: number[]
  playQueue: (tracks: Track[], startIndex: number) => void
  startRadio: () => Promise<void>
  toggle: () => void
  next: () => void
  prev: () => void
  seekTo: (seconds: number) => void
  setVolume: (v: number) => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  toggleLike: (trackId: number) => Promise<void>
  applyPreset: (name: string) => void
  applyCustomBands: (bands: number[]) => void
  applyProfile: (profile: EqProfile) => Promise<void>
  saveCustomBands: (name: string, bands: number[]) => Promise<void>
  removeProfile: (id: number) => Promise<void>
  clearEq: () => Promise<void>
}

const PlayerContext = createContext<PlayerContextValue>(null!)

function shuffledOrder(length: number, keepFirst: number): number[] {
  const indices = Array.from({ length }, (_, i) => i).filter(i => i !== keepFirst)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  return [keepFirst, ...indices]
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const audioRef = useRef<HTMLAudioElement>(new Audio())
  const eqChainRef = useRef<EqChain | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const restoredRef = useRef(false)

  const [queue, setQueue] = useState<Track[]>([])
  const [currentIndex, setCurrentIndex] = useState<number | null>(null)
  const [playOrder, setPlayOrder] = useState<number[]>([])
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.7)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<Repeat>('off')
  const [radioMode, setRadioMode] = useState(false)
  const [restored, setRestored] = useState(false)
  const [eqProfiles, setEqProfiles] = useState<EqProfile[]>([])
  const [activeEqLabel, setActiveEqLabel] = useState<string | null>(null)
  const [activeBands, setActiveBands] = useState<number[]>(EQ_PRESET_BANDS.flat)

  const currentTrack = currentIndex !== null ? queue[currentIndex] ?? null : null

  const ensureEqChain = (): EqChain => {
    if (eqChainRef.current) return eqChainRef.current
    const ctx = new AudioContext()
    const source = ctx.createMediaElementSource(audioRef.current)
    const chain = buildEqChain(ctx, source)
    chain.output.connect(ctx.destination)
    audioCtxRef.current = ctx
    eqChainRef.current = chain
    chain.setBands(activeBands)
    chain.setVolume(volume)
    audioRef.current.volume = 1
    return chain
  }

  const applyVolume = (v: number) => {
    if (eqChainRef.current) {
      eqChainRef.current.setVolume(v)
      audioRef.current.volume = 1
    } else {
      audioRef.current.volume = v
    }
  }

  useEffect(() => {
    const audio = audioRef.current
    applyVolume(volume)

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onDuration = () => setDuration(audio.duration || 0)
    const onEnded = () => handleEnded()
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDuration)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDuration)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, currentIndex, repeat, playOrder, radioMode])

  useEffect(() => {
    applyVolume(volume)
  }, [volume])

  useEffect(() => {
    if (!user || restoredRef.current) return
    restoredRef.current = true
    ;(async () => {
      const [state, profiles] = await Promise.all([getPlaybackState(), listEqProfiles()])
      setEqProfiles(profiles)
      if (typeof state.volume === 'number') setVolumeState(state.volume)
      if (user.active_eq_profile_id) {
        const active = profiles.find(p => p.id === user.active_eq_profile_id)
        if (active) {
          setActiveBands(active.bands_db)
          setActiveEqLabel(active.name)
        }
      } else if (user.active_eq_preset_id) {
        const bands = EQ_PRESET_BANDS[user.active_eq_preset_id as EqPresetId]
        if (bands) {
          setActiveBands(bands)
          setActiveEqLabel(user.active_eq_preset_id)
        }
      }
      if (state.queue_track_ids.length > 0) {
        const tracks = await getTracksByIds(state.queue_track_ids)
        if (tracks.length > 0) {
          setQueue(tracks)
          setPlayOrder(tracks.map((_, i) => i))
          const idx = state.track_id ? tracks.findIndex(t => t.id === state.track_id) : 0
          const startIndex = idx >= 0 ? idx : 0
          setCurrentIndex(startIndex)
          audioRef.current.src = trackStreamUrl(tracks[startIndex].id)
          audioRef.current.currentTime = state.position_seconds
        }
      }
      setRestored(true)
    })()
  }, [user])

  const persistState = () => {
    savePlaybackState({
      track_id: currentTrack?.id ?? null,
      position_seconds: audioRef.current.currentTime,
      queue_track_ids: queue.map(t => t.id),
      volume,
    }).catch(() => {})
  }

  useEffect(() => {
    if (!restored) return
    const id = setTimeout(persistState, 400)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume])

  useEffect(() => {
    const id = setInterval(() => { if (playing) persistState() }, 5000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, currentTrack, queue])

  const maybeLogHistory = () => {
    const audio = audioRef.current
    if (currentTrack && audio.duration > 0) {
      const ratio = audio.currentTime / audio.duration
      if (ratio >= 0.9) logHistory(currentTrack.id, ratio).catch(() => {})
    }
  }

  const loadAndPlayTrack = (track: Track | undefined, index: number, autoplay = true) => {
    if (!track) return
    ensureEqChain()
    audioCtxRef.current?.resume()
    audioRef.current.src = trackStreamUrl(track.id)
    audioRef.current.currentTime = 0
    setCurrentIndex(index)
    if (autoplay) audioRef.current.play().catch(() => {})
  }

  const loadAndPlay = (index: number, autoplay = true) => loadAndPlayTrack(queue[index], index, autoplay)

  const playQueue = (tracks: Track[], startIndex: number) => {
    maybeLogHistory()
    setRadioMode(false)
    setQueue(tracks)
    const order = shuffle ? shuffledOrder(tracks.length, startIndex) : tracks.map((_, i) => i)
    setPlayOrder(order)
    loadAndPlayTrack(tracks[startIndex], startIndex)
  }

  const startRadio = async () => {
    const tracks = await listRadioTracks(50)
    if (tracks.length === 0) return
    maybeLogHistory()
    setRadioMode(true)
    setQueue(tracks)
    setPlayOrder(tracks.map((_, i) => i))
    loadAndPlayTrack(tracks[0], 0)
  }

  const extendRadio = async () => {
    const more = await listRadioTracks(50)
    if (more.length === 0) {
      setPlaying(false)
      return
    }
    const startIdx = queue.length
    setQueue(prev => [...prev, ...more])
    setPlayOrder(prev => [...prev, ...more.map((_, i) => startIdx + i)])
    loadAndPlayTrack(more[0], startIdx)
  }

  const stepIndex = (direction: 1 | -1): number | null => {
    if (queue.length === 0 || currentIndex === null) return null
    const orderPos = playOrder.indexOf(currentIndex)
    const nextOrderPos = orderPos + direction
    if (nextOrderPos < 0) {
      return repeat === 'queue' ? playOrder[playOrder.length - 1] : null
    }
    if (nextOrderPos >= playOrder.length) {
      return repeat === 'queue' ? playOrder[0] : null
    }
    return playOrder[nextOrderPos]
  }

  const handleEnded = () => {
    maybeLogHistory()
    if (repeat === 'track') {
      loadAndPlay(currentIndex!)
      return
    }
    const nextIdx = stepIndex(1)
    if (nextIdx !== null) {
      loadAndPlay(nextIdx)
    } else if (radioMode) {
      extendRadio()
    } else {
      setPlaying(false)
    }
  }

  const toggle = () => {
    ensureEqChain()
    audioCtxRef.current?.resume()
    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => {})
    } else {
      audioRef.current.pause()
      persistState()
    }
  }

  const next = () => {
    maybeLogHistory()
    const nextIdx = stepIndex(1)
    if (nextIdx !== null) loadAndPlay(nextIdx)
    else if (radioMode) extendRadio()
  }

  const prev = () => {
    maybeLogHistory()
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0
      return
    }
    const prevIdx = stepIndex(-1)
    if (prevIdx !== null) loadAndPlay(prevIdx)
  }

  const seekTo = (seconds: number) => {
    audioRef.current.currentTime = seconds
  }

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.setActionHandler('play', toggle)
    navigator.mediaSession.setActionHandler('pause', toggle)
    navigator.mediaSession.setActionHandler('previoustrack', prev)
    navigator.mediaSession.setActionHandler('nexttrack', next)
    return () => {
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.setActionHandler('previoustrack', null)
      navigator.mediaSession.setActionHandler('nexttrack', null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, currentIndex, playOrder, repeat])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if (!currentTrack) {
      navigator.mediaSession.metadata = null
      return
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album,
      artwork: [{ src: trackCoverUrl(currentTrack.id) }],
    })
  }, [currentTrack])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  }, [playing])

  const setVolume = (v: number) => setVolumeState(Math.min(1, Math.max(0, v)))

  const toggleShuffle = () => {
    setShuffle(prev => {
      const next = !prev
      if (currentIndex !== null) {
        setPlayOrder(next ? shuffledOrder(queue.length, currentIndex) : queue.map((_, i) => i))
      }
      return next
    })
  }

  const cycleRepeat = () => {
    setRepeat(prev => (prev === 'off' ? 'queue' : prev === 'queue' ? 'track' : 'off'))
  }

  const toggleLike = async (trackId: number) => {
    const track = queue.find(t => t.id === trackId)
    const liked = track?.liked ?? false
    if (liked) await unlikeTrack(trackId)
    else await likeTrack(trackId)
    setQueue(prev => prev.map(t => (t.id === trackId ? { ...t, liked: !liked } : t)))
  }

  const applyPreset = (id: string) => {
    const bands = EQ_PRESET_BANDS[id as EqPresetId] ?? EQ_PRESET_BANDS.flat
    setActiveBands(bands)
    setActiveEqLabel(id)
    eqChainRef.current?.setBands(bands)
    setActiveEqPreset(id).catch(() => {})
  }

  const applyCustomBands = (bands: number[]) => {
    setActiveBands(bands)
    setActiveEqLabel(null)
    eqChainRef.current?.setBands(bands)
  }

  const applyProfile = async (profile: EqProfile) => {
    setActiveBands(profile.bands_db)
    setActiveEqLabel(profile.name)
    eqChainRef.current?.setBands(profile.bands_db)
    await setActiveEqProfile(profile.id)
  }

  const saveCustomBands = async (name: string, bands: number[]) => {
    const profile = await createEqProfile(name, bands)
    setEqProfiles(prev => [...prev, profile])
    await applyProfile(profile)
  }

  const removeProfile = async (id: number) => {
    await deleteEqProfile(id)
    setEqProfiles(prev => prev.filter(p => p.id !== id))
    if (eqProfiles.find(p => p.id === id)?.name === activeEqLabel) {
      applyPreset('flat')
    }
  }

  const clearEq = async () => {
    applyPreset('flat')
  }

  return (
    <PlayerContext.Provider value={{
      queue, currentIndex, currentTrack, playing, currentTime, duration, volume,
      shuffle, repeat, radioMode, eqProfiles, activeEqLabel, activeBands,
      playQueue, startRadio, toggle, next, prev, seekTo, setVolume, toggleShuffle, cycleRepeat,
      toggleLike, applyPreset, applyCustomBands, applyProfile, saveCustomBands, removeProfile, clearEq,
    }}>
      {children}
    </PlayerContext.Provider>
  )
}

export const usePlayer = () => useContext(PlayerContext)
