import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePlayer } from '../player/PlayerContext'
import { useI18n } from '../i18n/I18nContext'
import { getLyrics, type LyricsResult } from '../api'

export default function LyricsPanel({ onClose }: { onClose: () => void }) {
  const player = usePlayer()
  const { t } = useI18n()
  const track = player.currentTrack
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const linesRef = useRef<(HTMLParagraphElement | null)[]>([])

  useEffect(() => {
    if (!track) { setLyrics(null); return }
    setLoading(true)
    setLyrics(null)
    getLyrics(track.id).then(setLyrics).finally(() => setLoading(false))
  }, [track?.id])

  let activeIndex = -1
  if (lyrics?.synced) {
    lyrics.lines.forEach((line, i) => {
      if (line.time !== null && line.time <= player.currentTime) activeIndex = i
    })
  }

  useEffect(() => {
    if (activeIndex < 0) return
    linesRef.current[activeIndex]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIndex])

  return createPortal(
    <>
      <div className="side-panel-backdrop" onClick={onClose} />
      <div className="side-panel lyrics-panel">
        <button className="side-panel-close" onClick={onClose}>✕</button>
        <div className="side-panel-title">{t('lyrics.title')}</div>
        {track && <div className="side-panel-subtitle">{track.title} — {track.artist}</div>}

        {!track ? (
          <div className="empty-state">{t('nowplaying.nothing_playing')}</div>
        ) : loading ? (
          <div className="empty-state">{t('library.loading')}</div>
        ) : !lyrics?.found ? (
          <div className="empty-state">{t('lyrics.not_found')}</div>
        ) : (
          <div className="lyrics-lines">
            {lyrics.lines.map((line, i) => (
              <p
                key={i}
                ref={el => { linesRef.current[i] = el }}
                className={`lyrics-line ${i === activeIndex ? 'active' : ''}`}
              >
                {line.text}
              </p>
            ))}
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}
