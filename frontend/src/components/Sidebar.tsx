import { useEffect, useState } from 'react'
import type { Playlist } from '../api/types'
import { listPlaylists, deletePlaylist } from '../api'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import type { View } from '../viewTypes'
import BrandIcon from './BrandIcon'
import NewPlaylistModal from './NewPlaylistModal'
import SettingsModal from './SettingsModal'

const PLAYLIST_COLORS = ['#fa233b,#fb5c74', '#34c759,#30d158', '#0a84ff,#5ac8fa', '#bf5af2,#da8fff']

interface Props {
  view: View
  onSelect: (view: View) => void
  search: string
  onSearch: (text: string) => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  playlistsVersion: number
  onPlaylistsChanged: () => void
  open: boolean
  onClose: () => void
}

export default function Sidebar({ view, onSelect, search, onSearch, theme, onToggleTheme, playlistsVersion, onPlaylistsChanged, open, onClose }: Props) {
  const { user, signOut } = useAuth()
  const { t } = useI18n()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [showNewPlaylist, setShowNewPlaylist] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    listPlaylists().then(setPlaylists)
  }, [playlistsVersion])

  const isActive = (kind: View['kind'], extra?: (v: View) => boolean) =>
    view.kind === kind && (!extra || extra(view))

  const handlePlaylistCreated = (playlist: Playlist) => {
    onPlaylistsChanged()
    onSelect({ kind: 'playlist', id: playlist.id, name: playlist.name, smart: !!playlist.smart_field })
  }

  const handleRemovePlaylist = async (e: React.MouseEvent, playlist: Playlist) => {
    e.stopPropagation()
    if (!window.confirm(t('sidebar.delete_playlist_confirm', { name: playlist.name }))) return
    await deletePlaylist(playlist.id)
    onPlaylistsChanged()
    if (view.kind === 'playlist' && view.id === playlist.id) onSelect({ kind: 'songs' })
  }

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="sidebar-top">
        <div className="brand">
          <BrandIcon />
          LanPlayer
        </div>
        <button className="theme-toggle" onClick={onToggleTheme} title={t('sidebar.theme_toggle')}>
          {theme === 'dark' ? (
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" /><line x1="4" y1="12" x2="2" y2="12" /><line x1="22" y1="12" x2="20" y2="12" /></svg>
          ) : (
            <svg viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 0 8 8 6.5 6.5 0 0 1-8-8z" /></svg>
          )}
        </button>
      </div>

      <div className="search">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input
          type="text"
          placeholder={t('sidebar.search_placeholder')}
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>

      <nav className="nav-section">
        <div className="nav-title">{t('sidebar.library_title')}</div>
        <ul>
          <li className={`nav-item ${isActive('artists') || isActive('artist') ? 'active' : ''}`} onClick={() => { onSelect({ kind: 'artists' }); onClose() }}>
            <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            {t('sidebar.artists')}
          </li>
          <li className={`nav-item ${isActive('albums') || isActive('album') ? 'active' : ''}`} onClick={() => { onSelect({ kind: 'albums' }); onClose() }}>
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.5" /></svg>
            {t('sidebar.albums')}
          </li>
          <li className={`nav-item ${isActive('songs') ? 'active' : ''}`} onClick={() => { onSelect({ kind: 'songs' }); onClose() }}>
            <svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
            {t('sidebar.songs')}
          </li>
        </ul>
        <ul className="nav-secondary-group">
          <li
            className={`nav-item ${isActive('radio') ? 'active' : ''}`}
            onClick={() => { onSelect({ kind: 'radio' }); onClose() }}
          >
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 7.8a6 6 0 0 0 0 8.4M19 5a10 10 0 0 1 0 14M5 5a10 10 0 0 0 0 14" /></svg>
            {t('sidebar.radio')}
          </li>
          <li className={`nav-item ${isActive('recent') ? 'active' : ''}`} onClick={() => { onSelect({ kind: 'recent' }); onClose() }}>
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 16 14" /></svg>
            {t('sidebar.recent')}
          </li>
          <li className={`nav-item ${isActive('liked') ? 'active' : ''}`} onClick={() => { onSelect({ kind: 'liked' }); onClose() }}>
            <svg viewBox="0 0 24 24"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" /></svg>
            {t('sidebar.liked')}
          </li>
        </ul>
      </nav>

      <nav className="nav-section playlists">
        <div className="nav-title">
          {t('sidebar.playlists_title')}
          <button className="add-playlist" title={t('sidebar.new_playlist')} onClick={() => { setShowNewPlaylist(true); onClose() }}>+</button>
        </div>
        <ul>
          {playlists.map((p, i) => (
            <li
              key={p.id}
              className={`nav-item playlist-item ${isActive('playlist', v => v.kind === 'playlist' && v.id === p.id) ? 'active' : ''}`}
              onClick={() => { onSelect({ kind: 'playlist', id: p.id, name: p.name, smart: !!p.smart_field }); onClose() }}
              title={p.smart_field ? t('sidebar.smart_playlist') : undefined}
            >
              {p.smart_field ? (
                <svg viewBox="0 0 24 24" style={{ color: 'var(--accent)' }}><path d="M3 4h18M6 8h12M9 12h6M11 16h2" /></svg>
              ) : (
                <span className="pl-dot" style={{ background: `linear-gradient(135deg,${PLAYLIST_COLORS[i % PLAYLIST_COLORS.length]})` }} />
              )}
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
              <span className="playlist-row-actions">
                <button className="playlist-remove-btn" onClick={e => handleRemovePlaylist(e, p)} title={t('sidebar.delete')}>✕</button>
              </span>
            </li>
          ))}
        </ul>
      </nav>

      {showNewPlaylist && (
        <NewPlaylistModal onClose={() => setShowNewPlaylist(false)} onCreated={handlePlaylistCreated} />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      <div className="sidebar-footer">
        <span className="share-status">
          <span className="status-dot" />
          {user?.username}
        </span>
        <button className="settings-btn" onClick={() => { setShowSettings(true); onClose() }} title={t('sidebar.settings')}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </button>
        <button className="logout-btn" onClick={signOut}>{t('sidebar.logout')}</button>
      </div>
      </aside>
    </>
  )
}
