import { useEffect, useState } from 'react'
import { gradientFor } from '../utils/gradient'

interface Props {
  src: string
  seed: string
  className?: string
}

export default function Cover({ src, seed, className }: Props) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (failed) {
    return (
      <div className={`${className ?? ''} cover-placeholder`} style={{ background: `linear-gradient(135deg,${gradientFor(seed)})` }}>
        <svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
      </div>
    )
  }

  return <img className={className} loading="lazy" src={src} onError={() => setFailed(true)} />
}
