import { useEffect, useRef, useState } from 'react'
import type { Track, Album, Artist, Playlist } from '../api/types'
import {
  listSongs, listRecent, listAlbums, listAlbumTracks, listArtists, listArtistTracks,
  listLikedTracks, getPlaylistTracks, listPlaylists, addTrackToPlaylist,
  removeTrackFromPlaylist, rescanLibrary, exportPlaylistUrl,
} from '../api'
import Sidebar from '../components/Sidebar'
import TrackCollection from '../components/TrackCollection'
import AlbumGrid from '../components/AlbumGrid'
import ArtistGrid from '../components/ArtistGrid'
import RadioView from '../components/RadioView'
import NowPlayingBar from '../components/NowPlayingBar'
import { useI18n } from '../i18n/I18nContext'
import { useTheme } from '../theme/ThemeContext'
import { viewTitle, type View } from '../viewTypes'

const TRACK_LIST_VIEWS: View['kind'][] = ['songs', 'recent', 'album', 'artist', 'liked', 'playlist']
const PAGINATED_VIEWS: View['kind'][] = ['songs', 'recent']
const PAGE_SIZE = 100

export default function Library() {
  const { t } = useI18n()
  const [view, setView] = useState<View>({ kind: 'artists' })
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'list' | 'grid'>('list')
  const { theme, toggleTheme } = useTheme()
  const [playlistsVersion, setPlaylistsVersion] = useState(0)
  const [playlists, setPlaylists] = useState<Playlist[]>([])

  const [tracks, setTracks] = useState<Track[]>([])
  const [albums, setAlbums] = useState<Album[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [rescanning, setRescanning] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listPlaylists().then(setPlaylists)
  }, [playlistsVersion])

  const onSearch = (text: string) => {
    setSearch(text)
    if (text) setView({ kind: 'songs' })
  }

  const onSelectView = (v: View) => {
    setSearch('')
    setView(v)
  }

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0
    if (view.kind === 'songs') {
      listSongs(search, PAGE_SIZE, 0).then(page => { setTracks(page); setHasMore(page.length === PAGE_SIZE) })
    } else if (view.kind === 'recent') {
      listRecent(PAGE_SIZE, 0).then(page => { setTracks(page); setHasMore(page.length === PAGE_SIZE) })
    } else if (view.kind === 'albums') {
      listAlbums().then(setAlbums)
    } else if (view.kind === 'album') {
      listAlbumTracks(view.album, view.albumArtist).then(setTracks)
    } else if (view.kind === 'artists') {
      listArtists().then(setArtists)
    } else if (view.kind === 'artist') {
      listArtistTracks(view.name).then(setTracks)
    } else if (view.kind === 'liked') {
      listLikedTracks().then(setTracks)
    } else if (view.kind === 'playlist') {
      getPlaylistTracks(view.id).then(setTracks)
    }
  }, [view, search])

  const loadMore = async () => {
    if (loadingMore || !hasMore || !PAGINATED_VIEWS.includes(view.kind)) return
    setLoadingMore(true)
    try {
      const page = view.kind === 'songs'
        ? await listSongs(search, PAGE_SIZE, tracks.length)
        : await listRecent(PAGE_SIZE, tracks.length)
      setTracks(prev => [...prev, ...page])
      setHasMore(page.length === PAGE_SIZE)
    } finally {
      setLoadingMore(false)
    }
  }

  const onContentScroll = () => {
    const el = contentRef.current
    if (!el || !PAGINATED_VIEWS.includes(view.kind)) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) loadMore()
  }

  const handleAddToPlaylist = async (playlistId: number, trackId: number) => {
    await addTrackToPlaylist(playlistId, trackId)
    setPlaylistsVersion(v => v + 1)
  }

  const handleRemoveFromPlaylist = async (trackId: number) => {
    if (view.kind !== 'playlist') return
    await removeTrackFromPlaylist(view.id, trackId)
    setTracks(prev => prev.filter(t => t.id !== trackId))
    setPlaylistsVersion(v => v + 1)
  }

  const handleRescan = async () => {
    setRescanning(true)
    try {
      await rescanLibrary()
    } finally {
      setTimeout(() => setRescanning(false), 1500)
    }
  }

  const showListGridSwitch = TRACK_LIST_VIEWS.includes(view.kind)

  return (
    <>
      <div className="app">
        <Sidebar
          view={view}
          onSelect={onSelectView}
          search={search}
          onSearch={onSearch}
          theme={theme}
          onToggleTheme={toggleTheme}
          playlistsVersion={playlistsVersion}
          onPlaylistsChanged={() => setPlaylistsVersion(v => v + 1)}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="main">
          <header className="toolbar">
            <button className="hamburger-btn" onClick={() => setSidebarOpen(o => !o)} title={t('library.menu')}>
              <svg viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
            </button>
            <h1 className="view-title">{search ? t('library.search_title', { q: search }) : viewTitle(view, t)}</h1>

            {view.kind === 'playlist' && (
              <a className="switch-btn" href={exportPlaylistUrl(view.id)} title={t('library.export_m3u')}>
                <svg viewBox="0 0 24 24"><path d="M12 3v12" /><polyline points="7 10 12 15 17 10" /><path d="M5 21h14" /></svg>
              </a>
            )}

            <button className="switch-btn" onClick={handleRescan} title={t('library.refresh')} disabled={rescanning}>
              <svg viewBox="0 0 24 24" style={{ animation: rescanning ? 'spin 1s linear infinite' : undefined }}>
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>

            {showListGridSwitch && (
              <div className="view-switch">
                <button className={`switch-btn ${mode === 'list' ? 'active' : ''}`} onClick={() => setMode('list')} title={t('library.list_view')}>
                  <svg viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
                </button>
                <button className={`switch-btn ${mode === 'grid' ? 'active' : ''}`} onClick={() => setMode('grid')} title={t('library.grid_view')}>
                  <svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" /><rect x="13" y="4" width="7" height="7" /><rect x="4" y="13" width="7" height="7" /><rect x="13" y="13" width="7" height="7" /></svg>
                </button>
              </div>
            )}
          </header>

          <section className="content" ref={contentRef} onScroll={onContentScroll}>
            {view.kind === 'albums' && <AlbumGrid albums={albums} onOpen={onSelectView} />}
            {view.kind === 'artists' && <ArtistGrid artists={artists} onOpen={onSelectView} />}
            {view.kind === 'radio' && (
              <RadioView
                onArtistClick={name => onSelectView({ kind: 'artist', name })}
                onAlbumClick={(album, albumArtist) => onSelectView({ kind: 'album', album, albumArtist })}
              />
            )}
            {showListGridSwitch && (
              <TrackCollection
                tracks={tracks}
                mode={mode}
                playlists={playlists.filter(p => !p.smart_field)}
                onAddToPlaylist={handleAddToPlaylist}
                onRemove={view.kind === 'playlist' && !view.smart ? handleRemoveFromPlaylist : undefined}
                emptyLabel={search ? t('library.not_found') : undefined}
                selectable={view.kind !== 'album' && view.kind !== 'artist'}
                sortable={view.kind === 'artist' || view.kind === 'album'}
                onArtistClick={view.kind !== 'album' && view.kind !== 'artist' ? (name => onSelectView({ kind: 'artist', name })) : undefined}
                onAlbumClick={view.kind !== 'album' && view.kind !== 'artist' ? ((album, albumArtist) => onSelectView({ kind: 'album', album, albumArtist })) : undefined}
              />
            )}
            {loadingMore && <div className="empty-state">{t('library.loading')}</div>}
          </section>
        </main>
      </div>

      <NowPlayingBar
        onArtistClick={name => onSelectView({ kind: 'artist', name })}
        onAlbumClick={(album, albumArtist) => onSelectView({ kind: 'album', album, albumArtist })}
      />
    </>
  )
}
