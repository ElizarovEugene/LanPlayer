import { usePlayer } from '../player/PlayerContext'
import { useI18n } from '../i18n/I18nContext'
import { trackCoverUrl } from '../api'
import Cover from './Cover'

interface Props {
  onArtistClick?: (name: string) => void
  onAlbumClick?: (album: string, albumArtist: string) => void
}

export default function RadioView({ onArtistClick, onAlbumClick }: Props) {
  const player = usePlayer()
  const { t } = useI18n()
  const track = player.currentTrack
  const isRadioActive = player.radioMode && !!track

  const handlePlayClick = () => {
    if (isRadioActive) player.toggle()
    else player.startRadio()
  }

  return (
    <div className="radio-view">
      <p className="radio-description">{t('radio.description')}</p>

      <div className="radio-now-playing">
        <div className="radio-cover-wrap">
          {isRadioActive ? (
            <Cover className="cover-img" src={trackCoverUrl(track!.id)} seed={`${track!.album_artist || track!.artist}::${track!.album}`} />
          ) : (
            <div className="radio-cover-placeholder">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 7.8a6 6 0 0 0 0 8.4M19 5a10 10 0 0 1 0 14M5 5a10 10 0 0 0 0 14" /></svg>
            </div>
          )}
          <button className="radio-play-btn" onClick={handlePlayClick} title={isRadioActive && player.playing ? t('radio.pause') : t('radio.play')}>
            {isRadioActive && player.playing ? (
              <svg viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16" /><rect x="14" y="4" width="5" height="16" /></svg>
            ) : (
              <svg viewBox="0 0 24 24"><polygon points="6 4 20 12 6 20" /></svg>
            )}
          </button>
        </div>

        {isRadioActive ? (
          <div className="radio-meta">
            <div className="radio-track-line">
              {track!.track_no ? <span className="radio-track-no">#{track!.track_no}</span> : null}
              {track!.title}
            </div>
            <div className="radio-artist">
              {onArtistClick ? (
                <a className="col-link" onClick={() => onArtistClick(track!.artist)}>{track!.artist}</a>
              ) : track!.artist}
            </div>
            <div className="radio-album">
              {onAlbumClick ? (
                <a className="col-link" onClick={() => onAlbumClick(track!.album, track!.album_artist || track!.artist)}>{track!.album}</a>
              ) : track!.album}
              {track!.year ? ` · ${track!.year}` : ''}
            </div>
          </div>
        ) : (
          <div className="radio-hint">{t('radio.hint')}</div>
        )}
      </div>
    </div>
  )
}
