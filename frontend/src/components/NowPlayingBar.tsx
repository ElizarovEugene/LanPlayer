import { useRef, useState } from 'react'
import { usePlayer } from '../player/PlayerContext'
import { useI18n } from '../i18n/I18nContext'
import { trackCoverUrl } from '../api'
import { formatClock } from '../utils/time'
import EqPanel from './EqPanel'
import LyricsPanel from './LyricsPanel'
import Cover from './Cover'

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  return formatClock(seconds, 'floor')
}

function useDragBar(onChange: (pct: number) => void) {
  const barRef = useRef<HTMLDivElement>(null)

  const update = (clientX: number) => {
    const rect = barRef.current!.getBoundingClientRect()
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    onChange(pct)
  }

  const onMouseDown = (e: React.MouseEvent) => {
    update(e.clientX)
    const move = (ev: MouseEvent) => update(ev.clientX)
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    update(e.touches[0].clientX)
    const move = (ev: TouchEvent) => update(ev.touches[0].clientX)
    const end = () => {
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', end)
    }
    window.addEventListener('touchmove', move)
    window.addEventListener('touchend', end)
  }

  return { barRef, onMouseDown, onTouchStart }
}

interface Props {
  onArtistClick?: (name: string) => void
  onAlbumClick?: (album: string, albumArtist: string) => void
}

export default function NowPlayingBar({ onArtistClick, onAlbumClick }: Props) {
  const player = usePlayer()
  const { t } = useI18n()
  const [eqOpen, setEqOpen] = useState(false)
  const [lyricsOpen, setLyricsOpen] = useState(false)
  const track = player.currentTrack

  const seekDrag = useDragBar(pct => player.seekTo(pct * (player.duration || 0)))
  const volumeDrag = useDragBar(pct => player.setVolume(pct))

  const progressPct = player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0

  return (
    <footer className="now-playing">
      <div className="np-left">
        <span className="art mini now-art">
          {track && (
            <Cover className="cover-img" src={trackCoverUrl(track.id)} seed={`${track.album_artist || track.artist}::${track.album}`} />
          )}
        </span>
        <div className="np-meta">
          <div className="np-title">{track?.title ?? t('nowplaying.nothing_playing')}</div>
          <div className="np-artist">
            {track && (
              <>
                {onArtistClick ? (
                  <a className="col-link" onClick={() => onArtistClick(track.artist)}>{track.artist}</a>
                ) : track.artist}
                {' — '}
                {onAlbumClick ? (
                  <a className="col-link" onClick={() => onAlbumClick(track.album, track.album_artist || track.artist)}>{track.album}</a>
                ) : track.album}
              </>
            )}
          </div>
        </div>
        {track && (
          <button
            className={`like-btn ${track.liked ? 'liked' : ''}`}
            onClick={() => player.toggleLike(track.id)}
            title={t('nowplaying.like')}
          >{track.liked ? '♥' : '♡'}</button>
        )}
      </div>

      <div className="np-center">
        <div className="transport">
          <button className={`t-btn ${player.shuffle ? 'active' : ''}`} onClick={player.toggleShuffle} title={t('nowplaying.shuffle')}>
            <svg viewBox="0 0 24 24"><polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" /></svg>
          </button>
          <button className="t-btn" onClick={player.prev} disabled={!track} title={t('nowplaying.prev')}>
            <svg viewBox="0 0 24 24"><polygon points="19 20 9 12 19 4" /><line x1="5" y1="19" x2="5" y2="5" /></svg>
          </button>
          <button className="t-btn play-btn" onClick={player.toggle} disabled={!track} title={t('nowplaying.play_pause')}>
            {player.playing ? (
              <svg viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16" /><rect x="14" y="4" width="5" height="16" /></svg>
            ) : (
              <svg viewBox="0 0 24 24"><polygon points="6 4 20 12 6 20" /></svg>
            )}
          </button>
          <button className="t-btn" onClick={player.next} disabled={!track} title={t('nowplaying.next')}>
            <svg viewBox="0 0 24 24"><polygon points="5 4 15 12 5 20" /><line x1="19" y1="5" x2="19" y2="19" /></svg>
          </button>
          <button className={`t-btn ${player.repeat !== 'off' ? 'active' : ''}`} onClick={player.cycleRepeat} title={t('nowplaying.repeat')}>
            {player.repeat === 'track' ? (
              <svg viewBox="0 0 24 24">
                <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="700" stroke="none" fill="currentColor">1</text>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
            )}
          </button>
        </div>
        <div className="seek-row">
          <span className="time">{formatTime(player.currentTime)}</span>
          <div className="seek-bar" ref={seekDrag.barRef} onMouseDown={seekDrag.onMouseDown} onTouchStart={seekDrag.onTouchStart}>
            <div className="seek-fill" style={{ width: `${progressPct}%` }} />
            <div className="seek-thumb" style={{ left: `${progressPct}%` }} />
          </div>
          <span className="time">{track ? `-${formatTime((player.duration || 0) - player.currentTime)}` : '0:00'}</span>
        </div>
      </div>

      <div className="np-right">
        <button className={`t-btn small ${lyricsOpen ? 'active' : ''}`} onClick={() => setLyricsOpen(o => !o)} title={t('lyrics.title')}>
          <svg viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="16" y2="12" /><line x1="4" y1="18" x2="12" y2="18" /></svg>
        </button>
        <button className={`t-btn small ${eqOpen ? 'active' : ''}`} onClick={() => setEqOpen(o => !o)} title={t('nowplaying.eq')}>
          <svg viewBox="0 0 24 24"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><circle cx="4" cy="12" r="2" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><circle cx="12" cy="10" r="2" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><circle cx="20" cy="14" r="2" /></svg>
        </button>
        <div className="volume">
          <svg viewBox="0 0 24 24"><polygon points="4 9 9 9 13 5 13 19 9 15 4 15" /><path d="M17 8a5 5 0 0 1 0 8" /></svg>
          <div className="volume-bar" ref={volumeDrag.barRef} onMouseDown={volumeDrag.onMouseDown} onTouchStart={volumeDrag.onTouchStart}>
            <div className="volume-fill" style={{ width: `${player.volume * 100}%` }} />
          </div>
        </div>
      </div>

      {eqOpen && <EqPanel onClose={() => setEqOpen(false)} />}
      {lyricsOpen && <LyricsPanel onClose={() => setLyricsOpen(false)} />}
    </footer>
  )
}
