import { useEffect, useRef, useState } from 'react'
import type { AdminUser } from '../api/types'
import { listAdminUsers, deleteAdminUser, startUserScan, getUserScanStatus, type ScanStatus } from '../api'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import { apiErrorMessage } from '../utils/errors'
import UserFormModal from './UserFormModal'

export default function AdminView() {
  const { user: me } = useAuth()
  const { t } = useI18n()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [editing, setEditing] = useState<AdminUser | null | undefined>(undefined)
  const [error, setError] = useState('')
  const [scans, setScans] = useState<Record<number, ScanStatus>>({})
  const pollingIds = useRef<Set<number>>(new Set())

  const load = async () => {
    const list = await listAdminUsers()
    setUsers(list)
    // Скан может уже идти (например, запущен фоновым планировщиком) —
    // подхватываем его прогресс, а не только запущенный кнопкой.
    for (const u of list) {
      const status = await getUserScanStatus(u.id)
      if (status.scanning) {
        pollingIds.current.add(u.id)
        setScans(prev => ({ ...prev, [u.id]: status }))
      }
    }
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    const id = setInterval(() => {
      for (const userId of pollingIds.current) {
        getUserScanStatus(userId).then(status => {
          setScans(prev => ({ ...prev, [userId]: status }))
          if (!status.scanning) {
            pollingIds.current.delete(userId)
            load()
          }
        })
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])

  if (!me?.is_admin) return null

  const handleDelete = async (u: AdminUser) => {
    if (!window.confirm(t('admin.delete_confirm', { name: u.username }))) return
    setError('')
    try {
      await deleteAdminUser(u.id)
      load()
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  const handleScan = async (u: AdminUser) => {
    setError('')
    try {
      await startUserScan(u.id)
      pollingIds.current.add(u.id)
      setScans(prev => ({ ...prev, [u.id]: { scanning: true, processed: 0, total: 0 } }))
    } catch (e) {
      // 409 — скан уже идёт (например, запущен планировщиком): просто
      // подключаемся к его прогрессу вместо показа ошибки.
      const status = await getUserScanStatus(u.id).catch(() => null)
      if (status?.scanning) {
        pollingIds.current.add(u.id)
        setScans(prev => ({ ...prev, [u.id]: status }))
      } else {
        setError(apiErrorMessage(e))
      }
    }
  }

  return (
    <div className="admin-view">
      <div className="admin-toolbar">
        <button className="modal-submit-btn" onClick={() => setEditing(null)}>{t('admin.add_user')}</button>
      </div>

      {error && <p style={{ color: 'var(--accent)', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}

      <div className="admin-table-head">
        <span>{t('admin.username')}</span>
        <span>{t('admin.library_path')}</span>
        <span>{t('admin.is_active')}</span>
        <span>{t('admin.tracks')}</span>
        <span />
      </div>
      {users.map(u => {
        const scan = scans[u.id]
        return (
          <div className="admin-table-row" key={u.id}>
            <span>{u.username}</span>
            <span className="admin-path-cell">{u.library_path}</span>
            <span><span className={u.is_active ? 'admin-badge-on' : 'admin-badge-off'}>{u.is_active ? t('admin.yes') : t('admin.no')}</span></span>
            <span>
              {scan?.scanning ? (
                <span className="admin-scan-progress">
                  <span className="admin-scan-progress-bar">
                    <span
                      className="admin-scan-progress-fill"
                      style={{ width: scan.total > 0 ? `${Math.min(100, (scan.processed / scan.total) * 100)}%` : '0%' }}
                    />
                  </span>
                  <span className="admin-scan-progress-label">
                    {t('admin.scanning', { processed: scan.processed, total: scan.total })}
                  </span>
                </span>
              ) : u.track_count}
            </span>
            <span className="admin-row-actions">
              <button className="playlist-remove-btn" onClick={() => handleScan(u)} disabled={scan?.scanning}>{t('admin.scan')}</button>
              <button className="playlist-remove-btn" onClick={() => setEditing(u)}>{t('admin.edit')}</button>
              <button className="playlist-remove-btn" onClick={() => handleDelete(u)}>{t('admin.delete')}</button>
            </span>
          </div>
        )
      })}

      {editing !== undefined && (
        <UserFormModal user={editing} onClose={() => setEditing(undefined)} onSaved={load} />
      )}
    </div>
  )
}
