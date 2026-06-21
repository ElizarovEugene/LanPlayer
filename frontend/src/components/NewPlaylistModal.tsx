import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FacetValue, Playlist, SmartField } from '../api/types'
import { createPlaylist, createSmartPlaylist, listFacets, importPlaylist, type PlaylistImportResult } from '../api'
import { useI18n } from '../i18n/I18nContext'

const VALUE_PICKER_FIELDS: SmartField[] = ['year', 'genre', 'decade']
// Часто/редко слушаемые не требуют выбора значения — фиксированный порог
// совпадает с OFTEN_PLAYED_THRESHOLD/RARELY_PLAYED_THRESHOLD на бэкенде.
const FIXED_FIELD_VALUES: Partial<Record<SmartField, string>> = { often_played: '5', rarely_played: '1' }

export default function NewPlaylistModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Playlist) => void }) {
  const { t } = useI18n()
  const FIELD_LABELS: Record<SmartField, string> = {
    year: t('new_playlist_modal.field_year'),
    genre: t('new_playlist_modal.field_genre'),
    decade: t('new_playlist_modal.decade'),
    often_played: t('new_playlist_modal.often_played'),
    rarely_played: t('new_playlist_modal.rarely_played'),
  }
  const [mode, setMode] = useState<'static' | 'smart' | 'import'>('static')
  const [name, setName] = useState('')
  const [field, setField] = useState<SmartField>('genre')
  const [facets, setFacets] = useState<FacetValue[]>([])
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<PlaylistImportResult | null>(null)

  const needsValuePicker = VALUE_PICKER_FIELDS.includes(field)

  useEffect(() => {
    if (mode !== 'smart' || !needsValuePicker) return
    listFacets(field as 'year' | 'genre' | 'decade').then(values => {
      setFacets(values)
      setValue(values[0]?.value ?? '')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, field])

  const submit = async () => {
    setBusy(true)
    try {
      if (mode === 'import') {
        if (!importFile) return
        const result = await importPlaylist(importFile, name.trim() || undefined)
        setImportResult(result)
        onCreated(result.playlist)
        return
      }
      const playlist = mode === 'static'
        ? await createPlaylist(name.trim() || t('new_playlist_modal.default_name'))
        : await createSmartPlaylist(field, needsValuePicker ? value : FIXED_FIELD_VALUES[field] ?? '')
      onCreated(playlist)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = mode === 'static'
    ? name.trim().length > 0
    : mode === 'smart' ? (!needsValuePicker || value.length > 0) : !!importFile

  if (importResult) {
    return createPortal(
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-dialog" onClick={e => e.stopPropagation()}>
          <div className="modal-title">{t('new_playlist_modal.import_done_title')}</div>
          <div className="modal-field-label">
            {t('new_playlist_modal.import_matched', { n: importResult.matched })}
          </div>
          {importResult.unmatched.length > 0 && (
            <>
              <div className="modal-field-label" style={{ marginTop: 12 }}>
                {t('new_playlist_modal.import_unmatched', { n: importResult.unmatched.length })}
              </div>
              <div className="import-unmatched-list">
                {importResult.unmatched.map((line, i) => <div key={i}>{line}</div>)}
              </div>
            </>
          )}
          <div className="modal-actions">
            <span />
            <button className="modal-submit-btn" onClick={onClose}>{t('settings.close')}</button>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{t('new_playlist_modal.title')}</div>

        <div className="eq-preset-row" style={{ marginBottom: 16 }}>
          <button className={`eq-preset-btn ${mode === 'static' ? 'active' : ''}`} onClick={() => setMode('static')}>{t('new_playlist_modal.static')}</button>
          <button className={`eq-preset-btn ${mode === 'smart' ? 'active' : ''}`} onClick={() => setMode('smart')}>{t('new_playlist_modal.smart')}</button>
          <button className={`eq-preset-btn ${mode === 'import' ? 'active' : ''}`} onClick={() => setMode('import')}>{t('new_playlist_modal.import')}</button>
        </div>

        {mode === 'static' && (
          <input
            placeholder={t('new_playlist_modal.name_placeholder')}
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        )}

        {mode === 'smart' && (
          <>
            <div className="modal-field-label">{t('new_playlist_modal.by_field')}</div>
            <select
              className="modal-select"
              style={{ marginBottom: 14 }}
              value={field}
              onChange={e => setField(e.target.value as SmartField)}
            >
              <option value="genre">{t('new_playlist_modal.genre')}</option>
              <option value="year">{t('new_playlist_modal.year')}</option>
              <option value="decade">{t('new_playlist_modal.decade')}</option>
              <option value="often_played">{t('new_playlist_modal.often_played')}</option>
              <option value="rarely_played">{t('new_playlist_modal.rarely_played')}</option>
            </select>

            {needsValuePicker ? (
              <>
                <div className="modal-field-label">{t('new_playlist_modal.value_label', { field: FIELD_LABELS[field] })}</div>
                {facets.length === 0 ? (
                  <div className="empty-state" style={{ padding: '12px 0' }}>{t('new_playlist_modal.no_data')}</div>
                ) : (
                  <select value={value} onChange={e => setValue(e.target.value)} className="modal-select">
                    {facets.map(f => (
                      <option key={f.value} value={f.value}>{field === 'decade' ? `${f.value}-е` : f.value} ({f.track_count})</option>
                    ))}
                  </select>
                )}
              </>
            ) : (
              <div className="modal-field-label" style={{ textTransform: 'none' }}>
                {field === 'often_played' ? t('new_playlist_modal.often_played_hint') : t('new_playlist_modal.rarely_played_hint')}
              </div>
            )}
          </>
        )}

        {mode === 'import' && (
          <>
            <div className="modal-field-label">{t('new_playlist_modal.choose_file')}</div>
            <input
              type="file"
              accept=".m3u,.m3u8"
              onChange={e => setImportFile(e.target.files?.[0] ?? null)}
              style={{ marginBottom: 14 }}
            />
            <input
              placeholder={t('new_playlist_modal.name_placeholder')}
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </>
        )}

        <div className="modal-actions">
          <button className="playlist-remove-btn" onClick={onClose}>{t('new_playlist_modal.cancel')}</button>
          <button className="modal-submit-btn" disabled={!canSubmit || busy} onClick={submit}>
            {busy
              ? (mode === 'import' ? t('new_playlist_modal.importing') : t('new_playlist_modal.creating'))
              : (mode === 'import' ? t('new_playlist_modal.import') : t('new_playlist_modal.create'))}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
