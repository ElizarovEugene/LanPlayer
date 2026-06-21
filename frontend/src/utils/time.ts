export function formatClock(seconds: number, rounding: 'floor' | 'round' = 'floor'): string {
  const s = rounding === 'round' ? Math.round(seconds) : Math.floor(seconds)
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}
