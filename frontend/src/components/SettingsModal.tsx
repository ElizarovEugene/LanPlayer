import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import type { Lang } from '../i18n/translations'
import { getAppSettings, updateAppSettings, rescanLibrary } from '../api'

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const { t, lang, setLang } = useI18n()
  const [maskedKey, setMaskedKey] = useState('')
  const [newKey, setNewKey] = useState('')
  const [rescanning, setRescanning] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getAppSettings().then(s => setMaskedKey(s.fanart_api_key))
  }, [])

  const handleSave = async () => {
    if (!newKey.trim()) return
    const s = await updateAppSettings(newKey.trim())
    setMaskedKey(s.fanart_api_key)
    setNewKey('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleRescan = async () => {
    setRescanning(true)
    try {
      await rescanLibrary()
    } finally {
      setTimeout(() => setRescanning(false), 1500)
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{t('settings.title')}</div>

        <div className="modal-field-label">{t('settings.language')}</div>
        <select
          className="modal-select"
          style={{ marginBottom: 16 }}
          value={lang}
          onChange={e => setLang(e.target.value as Lang)}
        >
          <option value="ru">Русский</option>
          <option value="en">English</option>
        </select>

        <div className="modal-field-label">{t('settings.library_path')}</div>
        <input value={user?.library_path ?? ''} readOnly style={{ marginBottom: 16, opacity: 0.7 }} />

        <div className="modal-field-label">{t('settings.scanning')}</div>
        <button className="modal-submit-btn" style={{ marginBottom: 16 }} onClick={handleRescan} disabled={rescanning}>
          {rescanning ? t('settings.rescan_running') : t('settings.rescan_now')}
        </button>

        <div className="modal-field-label">{t('settings.fanart_key_label')}</div>
        {maskedKey && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>{t('settings.fanart_current', { key: maskedKey })}</div>}
        <input
          placeholder={t('settings.fanart_new_placeholder')}
          value={newKey}
          onChange={e => setNewKey(e.target.value)}
        />

        <div className="modal-actions">
          <button className="playlist-remove-btn" onClick={onClose}>{t('settings.close')}</button>
          <button className="modal-submit-btn" disabled={!newKey.trim()} onClick={handleSave}>
            {saved ? t('settings.saved') : t('settings.save_key')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
