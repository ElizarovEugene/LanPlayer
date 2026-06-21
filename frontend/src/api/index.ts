import api from './client'
import type {
  User, Track, Album, Artist, Playlist, PlaybackState, EqProfile, FacetValue, AppSettings, SmartField, AdminUser,
} from './types'

export async function login(username: string, password: string): Promise<void> {
  await api.post('/auth/login', { username, password })
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}

export async function getMe(): Promise<User> {
  const { data } = await api.get('/auth/me')
  return data
}

export async function updateLanguage(language: string): Promise<User> {
  const { data } = await api.put('/auth/me/language', { language })
  return data
}

export async function listSongs(search?: string, limit = 100, offset = 0): Promise<Track[]> {
  const { data } = await api.get('/library/songs', { params: { ...(search ? { search } : {}), limit, offset } })
  return data
}

export async function listRecent(limit = 100, offset = 0): Promise<Track[]> {
  const { data } = await api.get('/library/recent', { params: { limit, offset } })
  return data
}

export async function listRadioTracks(limit = 50): Promise<Track[]> {
  const { data } = await api.get('/library/radio', { params: { limit } })
  return data
}

export async function listAlbums(): Promise<Album[]> {
  const { data } = await api.get('/library/albums')
  return data
}

export async function listAlbumTracks(album: string, albumArtist: string): Promise<Track[]> {
  const { data } = await api.get('/library/albums/tracks', { params: { album, album_artist: albumArtist } })
  return data
}

export async function listArtists(): Promise<Artist[]> {
  const { data } = await api.get('/library/artists')
  return data
}

export async function listArtistTracks(name: string): Promise<Track[]> {
  const { data } = await api.get('/library/artists/tracks', { params: { name } })
  return data
}

export async function getTracksByIds(ids: number[]): Promise<Track[]> {
  if (ids.length === 0) return []
  const { data } = await api.get('/tracks/by-ids', { params: { ids: ids.join(',') } })
  return data
}

export async function rescanLibrary(): Promise<void> {
  await api.post('/library/rescan')
}

export function exportPlaylistUrl(playlistId: number): string {
  return `/api/playlists/${playlistId}/export.m3u`
}

export async function getAppSettings(): Promise<AppSettings> {
  const { data } = await api.get('/settings')
  return data
}

export async function updateAppSettings(fanartApiKey: string): Promise<AppSettings> {
  const { data } = await api.put('/settings', { fanart_api_key: fanartApiKey })
  return data
}

export async function listPlaylists(): Promise<Playlist[]> {
  const { data } = await api.get('/playlists')
  return data
}

export async function createPlaylist(name: string): Promise<Playlist> {
  const { data } = await api.post('/playlists', { name })
  return data
}

export async function createSmartPlaylist(field: SmartField, value: string, name?: string): Promise<Playlist> {
  const { data } = await api.post('/playlists/smart', { field, value, name })
  return data
}

export interface PlaylistImportResult {
  playlist: Playlist
  matched: number
  unmatched: string[]
}

export async function importPlaylist(file: File, name?: string): Promise<PlaylistImportResult> {
  const form = new FormData()
  form.append('file', file)
  if (name) form.append('name', name)
  const { data } = await api.post('/playlists/import', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return data
}

export async function listFacets(field: 'year' | 'genre' | 'decade'): Promise<FacetValue[]> {
  const { data } = await api.get('/library/facets', { params: { field } })
  return data
}

export async function deletePlaylist(id: number): Promise<void> {
  await api.delete(`/playlists/${id}`)
}

export async function getPlaylistTracks(id: number): Promise<Track[]> {
  const { data } = await api.get(`/playlists/${id}/tracks`)
  return data
}

export async function addTrackToPlaylist(playlistId: number, trackId: number): Promise<void> {
  await api.post(`/playlists/${playlistId}/tracks`, { track_id: trackId })
}

export async function removeTrackFromPlaylist(playlistId: number, trackId: number): Promise<void> {
  await api.delete(`/playlists/${playlistId}/tracks/${trackId}`)
}

export async function listLikedTracks(): Promise<Track[]> {
  const { data } = await api.get('/likes')
  return data
}

export async function likeTrack(trackId: number): Promise<void> {
  await api.put(`/likes/${trackId}`)
}

export async function unlikeTrack(trackId: number): Promise<void> {
  await api.delete(`/likes/${trackId}`)
}

export async function logHistory(trackId: number, playedRatio: number): Promise<void> {
  await api.post('/history', { track_id: trackId, played_ratio: playedRatio })
}

export async function getPlaybackState(): Promise<PlaybackState> {
  const { data } = await api.get('/playback-state')
  return data
}

export async function savePlaybackState(state: PlaybackState): Promise<void> {
  await api.put('/playback-state', state)
}

export async function listEqProfiles(): Promise<EqProfile[]> {
  const { data } = await api.get('/eq-profiles')
  return data
}

export async function createEqProfile(name: string, bandsDb: number[]): Promise<EqProfile> {
  const { data } = await api.post('/eq-profiles', { name, bands_db: bandsDb })
  return data
}

export async function deleteEqProfile(id: number): Promise<void> {
  await api.delete(`/eq-profiles/${id}`)
}

export async function setActiveEqProfile(id: number): Promise<void> {
  await api.put(`/eq-profiles/active/${id}`)
}

export async function setActiveEqPreset(presetId: string): Promise<void> {
  await api.put(`/eq-profiles/active-preset/${presetId}`)
}

export function trackStreamUrl(trackId: number): string {
  return `/api/tracks/${trackId}/stream`
}

export function trackCoverUrl(trackId: number): string {
  return `/api/tracks/${trackId}/cover`
}

export function artistPhotoUrl(name: string): string {
  return `/api/artists/photo?name=${encodeURIComponent(name)}`
}

export interface LyricsLine {
  time: number | null
  text: string
}

export interface LyricsResult {
  found: boolean
  synced: boolean
  lines: LyricsLine[]
}

export async function getLyrics(trackId: number): Promise<LyricsResult> {
  const { data } = await api.get(`/tracks/${trackId}/lyrics`)
  return data
}

export interface AdminUserInput {
  username?: string
  password?: string
  library_path?: string
  is_active?: boolean
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const { data } = await api.get('/admin/users')
  return data
}

export async function createAdminUser(input: AdminUserInput): Promise<AdminUser> {
  const { data } = await api.post('/admin/users', input)
  return data
}

export async function updateAdminUser(id: number, input: AdminUserInput): Promise<AdminUser> {
  const { data } = await api.put(`/admin/users/${id}`, input)
  return data
}

export async function deleteAdminUser(id: number): Promise<void> {
  await api.delete(`/admin/users/${id}`)
}

export interface ScanStatus {
  scanning: boolean
  processed: number
  total: number
}

export async function startUserScan(id: number): Promise<void> {
  await api.post(`/admin/users/${id}/scan`)
}

export async function getUserScanStatus(id: number): Promise<ScanStatus> {
  const { data } = await api.get(`/admin/users/${id}/scan`)
  return data
}
