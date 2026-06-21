import type { Album } from '../api/types'
import { trackCoverUrl, listAlbumTracks } from '../api'
import { usePlayer } from '../player/PlayerContext'
import { useI18n } from '../i18n/I18nContext'
import type { View } from '../viewTypes'
import Cover from './Cover'

export default function AlbumGrid({ albums, onOpen }: { albums: Album[]; onOpen: (view: View) => void }) {
  const player = usePlayer()
  const { t } = useI18n()

  if (albums.length === 0) return <div className="empty-state">{t('album_grid.empty')}</div>

  const playAlbum = async (album: Album, e: React.MouseEvent) => {
    e.stopPropagation()
    const tracks = await listAlbumTracks(album.album, album.album_artist)
    if (tracks.length > 0) player.playQueue(tracks, 0)
  }

  return (
    <div className="album-grid">
      {albums.map(a => (
        <div
          className="album-card"
          key={`${a.album_artist}::${a.album}`}
          onClick={() => onOpen({ kind: 'album', album: a.album, albumArtist: a.album_artist })}
        >
          <div className="art big">
            <Cover className="cover-img" src={trackCoverUrl(a.sample_track_id)} seed={`${a.album_artist}::${a.album}`} />
            <button className="play-overlay" onClick={e => playAlbum(a, e)}>▶</button>
          </div>
          <div className="album-title">{a.album}</div>
          <div className="album-artist">{a.album_artist}</div>
        </div>
      ))}
    </div>
  )
}
