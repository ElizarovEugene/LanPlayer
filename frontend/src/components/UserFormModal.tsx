import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { AdminUser } from '../api/types'
import { createAdminUser, updateAdminUser, type AdminUserInput } from '../api'
import { useI18n } from '../i18n/I18nContext'
import { apiErrorMessage } from '../utils/errors'

interface Props {
  user: AdminUser | null
  onClose: () => void
  onSaved: () => void
}

export default function UserFormModal({ user, onClose, onSaved }: Props) {
  const { t } = useI18n()
  const isEdit = !!user
  const [username, setUsername] = useState(user?.username ?? '')
  const [password, setPassword] = useState('')
  const [libraryPath, setLibraryPath] = useState(user?.library_path ?? '')
  const [isActive, setIsActive] = useState(user?.is_active ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = isEdit
    ? libraryPath.trim().length > 0
    : username.trim().length > 0 && password.length > 0 && libraryPath.trim().length > 0

  const submit = async () => {
    if (!canSubmit) { setError(t('admin.fill_required')); return }
    setBusy(true)
    setError('')
    try {
      if (isEdit) {
        const input: AdminUserInput = { library_path: libraryPath.trim(), is_active: isActive }
        if (password) input.password = password
        await updateAdminUser(user!.id, input)
      } else {
        await createAdminUser({ username: username.trim(), password, library_path: libraryPath.trim() })
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{isEdit ? t('admin.edit_user') : t('admin.new_user')}</div>

        <div className="modal-field-label">{t('admin.username')}</div>
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          readOnly={isEdit}
          style={{ marginBottom: 14, opacity: isEdit ? 0.7 : 1 }}
          autoFocus={!isEdit}
        />

        <div className="modal-field-label">{t('admin.password')}</div>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder={isEdit ? t('admin.password_keep_hint') : undefined}
          style={{ marginBottom: 14 }}
        />

        <div className="modal-field-label">{t('admin.library_path')}</div>
        <input
          value={libraryPath}
          onChange={e => setLibraryPath(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        {isEdit && (
          <>
            <div className="modal-field-label">{t('admin.is_active')}</div>
            <select
              className="modal-select"
              style={{ marginBottom: 14 }}
              value={isActive ? '1' : '0'}
              onChange={e => setIsActive(e.target.value === '1')}
            >
              <option value="1">{t('admin.yes')}</option>
              <option value="0">{t('admin.no')}</option>
            </select>
          </>
        )}

        {error && <p style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 8 }}>{error}</p>}

        <div className="modal-actions">
          <button className="playlist-remove-btn" onClick={onClose}>{t('admin.cancel')}</button>
          <button className="modal-submit-btn" disabled={!canSubmit || busy} onClick={submit}>
            {isEdit ? t('admin.save') : t('admin.create')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
