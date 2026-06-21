export function apiErrorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'response' in e) {
    const detail = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
    if (detail) return detail
  }
  return String(e)
}
