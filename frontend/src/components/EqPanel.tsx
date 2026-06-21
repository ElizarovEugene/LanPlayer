import { useState } from 'react'
import { usePlayer } from '../player/PlayerContext'
import { useI18n } from '../i18n/I18nContext'
import type { TranslationKey } from '../i18n/translations'
import { EQ_BAND_HZ, EQ_PRESET_BANDS, EQ_PRESET_IDS } from '../player/equalizer'

function formatHz(hz: number, lang: string): string {
  return hz >= 1000 ? `${hz / 1000}${lang === 'ru' ? 'к' : 'k'}` : `${hz}`
}

export default function EqPanel({ onClose }: { onClose: () => void }) {
  const player = usePlayer()
  const { t, lang } = useI18n()
  const [bands, setBands] = useState<number[]>(player.activeBands)
  const [name, setName] = useState('')

  const setBand = (i: number, value: number) => {
    const next = bands.slice()
    next[i] = value
    setBands(next)
    player.applyCustomBands(next)
  }

  return (
    <div className="eq-panel" onClick={e => e.stopPropagation()}>
      <div className="eq-panel-title">{t('eq.title')}</div>

      <select
        className="eq-preset-select"
        value={(EQ_PRESET_IDS as readonly string[]).includes(player.activeEqLabel ?? '') ? player.activeEqLabel ?? '' : ''}
        onChange={e => {
          const presetId = e.target.value
          if (!presetId) return
          player.applyPreset(presetId)
          setBands(EQ_PRESET_BANDS[presetId as keyof typeof EQ_PRESET_BANDS])
        }}
      >
        <option value="" disabled>{t('eq.choose_preset')}</option>
        {EQ_PRESET_IDS.map(presetId => (
          <option key={presetId} value={presetId}>{t(`eq_preset.${presetId}` as TranslationKey)}</option>
        ))}
      </select>

      <div className="eq-bands-row">
        {EQ_BAND_HZ.map((hz, i) => (
          <div className="eq-band" key={hz}>
            <input
              type="range"
              min={-12}
              max={12}
              step={1}
              value={bands[i] ?? 0}
              onChange={e => setBand(i, Number(e.target.value))}
            />
            <span className="eq-band-label">{formatHz(hz, lang)}</span>
          </div>
        ))}
      </div>

      {player.eqProfiles.length > 0 && (
        <div className="eq-saved-list">
          {player.eqProfiles.map(p => (
            <div
              key={p.id}
              className={`eq-saved-row ${player.activeEqLabel === p.name ? 'active' : ''}`}
              onClick={() => { player.applyProfile(p); setBands(p.bands_db) }}
            >
              <span>{p.name}</span>
              <button
                className="playlist-remove-btn"
                onClick={e => { e.stopPropagation(); player.removeProfile(p.id) }}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="eq-save-row">
        <input
          placeholder={t('eq.profile_name_placeholder')}
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <button
          onClick={async () => {
            if (!name.trim()) return
            await player.saveCustomBands(name.trim(), bands)
            setName('')
          }}
        >{t('eq.save')}</button>
      </div>

      <button className="playlist-remove-btn" style={{ marginTop: 8 }} onClick={onClose}>{t('eq.close')}</button>
    </div>
  )
}
