import { useState } from 'react'
import type { Artist } from '../api/types'
import type { View } from '../viewTypes'
import { artistPhotoUrl, listArtistTracks } from '../api'
import { usePlayer } from '../player/PlayerContext'
import { useI18n } from '../i18n/I18nContext'
import { gradientFor } from '../utils/gradient'

export default function ArtistGrid({ artists, onOpen }: { artists: Artist[]; onOpen: (view: View) => void }) {
  const player = usePlayer()
  const { t } = useI18n()
  const [photoFailed, setPhotoFailed] = useState<Record<string, boolean>>({})

  if (artists.length === 0) return <div className="empty-state">{t('artist_grid.empty')}</div>

  const playArtist = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const tracks = await listArtistTracks(name)
    if (tracks.length > 0) player.playQueue(tracks, 0)
  }

  return (
    <div className="album-grid">
      {artists.map(a => (
        <div className="album-card artist-card" key={a.name} onClick={() => onOpen({ kind: 'artist', name: a.name })}>
          <div
            className="art big artist-avatar-big"
            style={{ background: photoFailed[a.name] ? `linear-gradient(135deg,${gradientFor(a.name)})` : undefined }}
          >
            {!photoFailed[a.name] && (
              <img
                className="artist-avatar-img"
                loading="lazy"
                src={artistPhotoUrl(a.name)}
                onError={() => setPhotoFailed(prev => ({ ...prev, [a.name]: true }))}
              />
            )}
            <button className="play-overlay" onClick={e => playArtist(a.name, e)}>▶</button>
          </div>
          <div className="album-title">{a.name}</div>
          <div className="album-artist">{t('artist_grid.stats', { albums: a.album_count, tracks: a.track_count })}</div>
        </div>
      ))}
    </div>
  )
}
