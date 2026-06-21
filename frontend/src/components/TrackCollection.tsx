import { useEffect, useState } from 'react'
import type { Track, Playlist } from '../api/types'
import { trackCoverUrl, createPlaylist } from '../api'
import { usePlayer } from '../player/PlayerContext'
import { useI18n } from '../i18n/I18nContext'
import { formatClock } from '../utils/time'
import Cover from './Cover'

function formatTime(seconds: number | null): string {
  if (!seconds || !isFinite(seconds)) return '—'
  return formatClock(seconds, 'round')
}

interface Props {
  tracks: Track[]
  mode: 'list' | 'grid'
  playlists?: Playlist[]
  onAddToPlaylist?: (playlistId: number, trackId: number) => void
  onRemove?: (trackId: number) => void
  emptyLabel?: string
  selectable?: boolean
  sortable?: boolean
  onArtistClick?: (name: string) => void
  onAlbumClick?: (album: string, albumArtist: string) => void
}

interface ContextMenuState { x: number; y: number; trackId: number }

type SortKey = 'trackNo' | 'title' | 'album' | 'year'

export default function TrackCollection({
  tracks, mode, playlists, onAddToPlaylist, onRemove, emptyLabel, selectable = true, sortable = false,
  onArtistClick, onAlbumClick,
}: Props) {
  const player = usePlayer()
  const { t: tr } = useI18n()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [lastIndex, setLastIndex] = useState<number | null>(null)
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [submenuOpen, setSubmenuOpen] = useState(false)
  const [infoTrack, setInfoTrack] = useState<Track | null>(null)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    if (!menu) return
    const close = () => { setMenu(null); setSubmenuOpen(false) }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menu])

  useEffect(() => {
    setSelected(new Set())
    setLastIndex(null)
  }, [tracks])

  if (tracks.length === 0) {
    return <div className="empty-state">{emptyLabel ?? tr('track.empty')}</div>
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = sortKey
    ? [...tracks].sort((a, b) => {
        const cmp = sortKey === 'year'
          ? (a.year ?? 0) - (b.year ?? 0)
          : sortKey === 'trackNo'
            ? (a.track_no ?? 0) - (b.track_no ?? 0)
            : (a[sortKey] ?? '').localeCompare(b[sortKey] ?? '', 'ru')
        return sortDir === 'asc' ? cmp : -cmp
      })
    : tracks

  const sortIndicator = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '')

  const play = (index: number) => player.playQueue(sorted, index)

  const handleRowClick = (e: React.MouseEvent, index: number) => {
    const id = sorted[index].id
    if (e.shiftKey && lastIndex !== null) {
      const from = Math.min(lastIndex, index)
      const to = Math.max(lastIndex, index)
      setSelected(new Set(sorted.slice(from, to + 1).map(t => t.id)))
    } else if (e.ctrlKey || e.metaKey) {
      setSelected(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      setLastIndex(index)
    } else {
      setSelected(new Set([id]))
      setLastIndex(index)
    }
  }

  const handleContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault()
    const id = sorted[index].id
    if (!selected.has(id)) {
      setSelected(new Set([id]))
      setLastIndex(index)
    }
    setSubmenuOpen(false)
    const menuWidth = 220
    const menuHeight = 90
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8)
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8)
    setMenu({ x, y, trackId: id })
  }

  const targetIds = (): number[] => (selected.size > 0 ? Array.from(selected) : menu ? [menu.trackId] : [])

  const addToPlaylist = async (playlistId: number) => {
    if (!onAddToPlaylist) return
    for (const id of targetIds()) {
      await onAddToPlaylist(playlistId, id)
    }
    setMenu(null)
    setSubmenuOpen(false)
  }

  const createPlaylistAndAdd = async () => {
    const name = window.prompt(tr('track.new_playlist_prompt'))
    if (!name) return
    const playlist = await createPlaylist(name)
    await addToPlaylist(playlist.id)
  }

  const openInfo = () => {
    const track = sorted.find(t => t.id === menu?.trackId)
    if (track) setInfoTrack(track)
    setMenu(null)
  }

  if (mode === 'grid') {
    return (
      <div className="album-grid">
        {sorted.map((t, i) => (
          <div className="album-card" key={`${t.id}-${i}`}>
            <div className="art big">
              <Cover className="cover-img" src={trackCoverUrl(t.id)} seed={`${t.album_artist || t.artist}::${t.album}`} />
              <button className="play-overlay" onClick={() => play(i)}>▶</button>
            </div>
            <div className="album-title">{t.title}</div>
            <div className="album-artist">{t.artist}</div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className="track-list visible"
      onClick={selectable ? e => { if (e.target === e.currentTarget) setSelected(new Set()) } : undefined}
    >
      <div className="track-list-head">
        <span className={`col-num ${sortable ? 'col-sortable' : ''}`} onClick={sortable ? () => toggleSort('trackNo') : undefined}>
          {tr('track.col_num')}{sortable && sortIndicator('trackNo')}
        </span>
        <span className={`col-title ${sortable ? 'col-sortable' : ''}`} onClick={sortable ? () => toggleSort('title') : undefined}>
          {tr('track.col_title')}{sortable && sortIndicator('title')}
        </span>
        <span className="col-artist">{tr('track.col_artist')}</span>
        <span className={`col-album ${sortable ? 'col-sortable' : ''}`} onClick={sortable ? () => toggleSort('album') : undefined}>
          {tr('track.col_album')}{sortable && sortIndicator('album')}
        </span>
        <span className={`col-year ${sortable ? 'col-sortable' : ''}`} onClick={sortable ? () => toggleSort('year') : undefined}>
          {tr('track.col_year')}{sortable && sortIndicator('year')}
        </span>
        <span className="col-like" />
        <span className="col-time">⏱</span>
        <span />
      </div>
      {sorted.map((t, i) => {
        const isCurrent = player.currentTrack?.id === t.id
        const isSelected = selectable && selected.has(t.id)
        return (
          <div
            key={`${t.id}-${i}`}
            className={`track-row ${isCurrent ? 'playing' : ''} ${isSelected ? 'selected' : ''}`}
            onClick={selectable ? e => handleRowClick(e, i) : undefined}
            onContextMenu={selectable ? e => handleContextMenu(e, i) : undefined}
          >
            <span className="col-num">
              {isCurrent && player.playing ? (
                <svg className="eq" viewBox="0 0 16 16"><rect x="1" y="6" width="2" height="8" /><rect x="7" y="2" width="2" height="12" /><rect x="13" y="8" width="2" height="6" /></svg>
              ) : (t.track_no ?? i + 1)}
            </span>
            <span className="col-title">
              <span className="art-wrap-mini" onClick={e => e.stopPropagation()}>
                <span className="art mini">
                  <Cover className="cover-img" src={trackCoverUrl(t.id)} seed={`${t.album_artist || t.artist}::${t.album}`} />
                </span>
                <button className="mini-play-overlay" onClick={() => play(i)}>▶</button>
              </span>
              <span className="col-title-text">
                <span className="col-title-main">{t.title}</span>
                <span className="col-title-sub">{t.artist}</span>
              </span>
            </span>
            <span className="col-artist">
              {onArtistClick ? (
                <a className="col-link" onClick={e => { e.stopPropagation(); onArtistClick(t.artist) }}>{t.artist}</a>
              ) : t.artist}
            </span>
            <span className="col-album">
              {onAlbumClick ? (
                <a className="col-link" onClick={e => { e.stopPropagation(); onAlbumClick(t.album, t.album_artist || t.artist) }}>{t.album}</a>
              ) : t.album}
            </span>
            <span className="col-year">{t.year ?? '—'}</span>
            <span className="col-like" onClick={e => e.stopPropagation()}>
              <button
                className={`row-like-btn ${t.liked ? 'liked' : ''}`}
                onClick={() => player.toggleLike(t.id)}
                title={tr('track.like')}
              >{t.liked ? '♥' : '♡'}</button>
            </span>
            <span className="col-time">{formatTime(t.duration_seconds)}</span>
            <span onClick={e => e.stopPropagation()}>
              {onRemove && (
                <button className="playlist-remove-btn" onClick={() => onRemove(t.id)} title={tr('track.remove_from_playlist')}>✕</button>
              )}
            </span>
          </div>
        )
      })}

      {selectable && menu && (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }} onClick={e => e.stopPropagation()}>
          <div
            className="context-menu-item has-submenu"
            onMouseEnter={() => setSubmenuOpen(true)}
            onMouseLeave={() => setSubmenuOpen(false)}
          >
            {tr('track.add_to_playlist')}
            <span className="context-menu-arrow">›</span>
            {submenuOpen && (
              <div className="context-submenu">
                <div className="context-menu-item" onClick={createPlaylistAndAdd}>{tr('track.new_playlist')}</div>
                {playlists && playlists.length > 0 && <div className="context-menu-sep" />}
                {playlists?.map(p => (
                  <div key={p.id} className="context-menu-item" onClick={() => addToPlaylist(p.id)}>{p.name}</div>
                ))}
              </div>
            )}
          </div>
          <div className="context-menu-item" onClick={openInfo}>{tr('track.show_info')}</div>
        </div>
      )}

      {selectable && infoTrack && (
        <>
          <div className="side-panel-backdrop" onClick={() => setInfoTrack(null)} />
          <div className="side-panel">
            <button className="side-panel-close" onClick={() => setInfoTrack(null)}>✕</button>
            <div className="side-panel-cover">
              <Cover className="cover-img" src={trackCoverUrl(infoTrack.id)} seed={`${infoTrack.album_artist || infoTrack.artist}::${infoTrack.album}`} />
            </div>
            <div className="side-panel-title">{infoTrack.title}</div>
            <div className="side-panel-subtitle">{infoTrack.artist}</div>
            <dl className="side-panel-meta">
              <dt>{tr('track.info_album')}</dt><dd>{infoTrack.album}</dd>
              {infoTrack.album_artist && infoTrack.album_artist !== infoTrack.artist && (
                <><dt>{tr('track.info_album_artist')}</dt><dd>{infoTrack.album_artist}</dd></>
              )}
              <dt>{tr('track.info_track_no')}</dt><dd>{infoTrack.track_no ?? '—'}</dd>
              <dt>{tr('track.info_year')}</dt><dd>{infoTrack.year ?? '—'}</dd>
              <dt>{tr('track.info_genre')}</dt><dd>{infoTrack.genre ?? '—'}</dd>
              <dt>{tr('track.info_duration')}</dt><dd>{formatTime(infoTrack.duration_seconds)}</dd>
            </dl>
          </div>
        </>
      )}
    </div>
  )
}
