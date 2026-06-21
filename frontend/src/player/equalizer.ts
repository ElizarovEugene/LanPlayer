export const EQ_BAND_HZ = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

export const EQ_PRESET_IDS = [
  'flat', 'bass', 'bass_boost', 'bass_cut', 'vocal', 'electronic', 'pop',
  'rock', 'jazz', 'classical', 'acoustic', 'treble_boost', 'headphones', 'speech',
] as const

export type EqPresetId = typeof EQ_PRESET_IDS[number]

export const EQ_PRESET_BANDS: Record<EqPresetId, number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  bass_boost: [9, 7, 5, 3, 1, 0, 0, 0, 0, 0],
  bass_cut: [-6, -5, -4, -2, 0, 0, 0, 0, 0, 0],
  vocal: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1],
  electronic: [4, 3, 1, 0, -1, -1, 0, 2, 3, 4],
  pop: [-1, 0, 2, 3, 3, 1, 0, -1, -1, -1],
  rock: [4, 3, 2, 0, -1, 0, 2, 3, 3, 3],
  jazz: [2, 1, 0, 0, -1, -1, 0, 1, 2, 3],
  classical: [3, 2, 1, 0, 0, 0, -1, -1, 0, 2],
  acoustic: [2, 2, 1, 0, 0, 0, 1, 2, 3, 3],
  treble_boost: [-2, -1, 0, 0, 0, 1, 3, 5, 6, 7],
  headphones: [3, 2, 0, -1, -1, 0, 1, 2, 3, 4],
  speech: [-3, -2, -1, 2, 5, 5, 3, 1, 0, -1],
}

export interface EqChain {
  filters: BiquadFilterNode[]
  gain: GainNode
  input: AudioNode
  output: AudioNode
  setBands: (bands: number[]) => void
  setVolume: (v: number) => void
}

export function buildEqChain(ctx: AudioContext, source: AudioNode): EqChain {
  const filters = EQ_BAND_HZ.map(freq => {
    const filter = ctx.createBiquadFilter()
    filter.type = 'peaking'
    filter.frequency.value = freq
    filter.Q.value = 1
    filter.gain.value = 0
    return filter
  })

  source.connect(filters[0])
  for (let i = 0; i < filters.length - 1; i++) {
    filters[i].connect(filters[i + 1])
  }

  // Громкость регулируем через этот узел, а не через audio.volume — в
  // Safari/WebKit после createMediaElementSource() свойство volume у
  // <audio> перестаёт влиять на звук (известная особенность WebKit).
  const gain = ctx.createGain()
  filters[filters.length - 1].connect(gain)

  return {
    filters,
    gain,
    input: filters[0],
    output: gain,
    setBands: (bands: number[]) => {
      filters.forEach((filter, i) => {
        filter.gain.value = bands[i] ?? 0
      })
    },
    setVolume: (v: number) => {
      gain.gain.value = v
    },
  }
}
