export interface User {
  id: number
  username: string
  library_path: string
  active_eq_profile_id: number | null
  active_eq_preset_id: string | null
  language: string
  is_admin: boolean
}

export interface AdminUser {
  id: number
  username: string
  library_path: string
  is_active: boolean
  track_count: number
}

export interface AppSettings {
  fanart_api_key: string
}

export interface Track {
  id: number
  title: string
  artist: string
  album: string
  album_artist: string | null
  track_no: number | null
  year: number | null
  genre: string | null
  duration_seconds: number | null
  has_cover: boolean
  liked: boolean
}

export interface Album {
  album: string
  album_artist: string
  year: number | null
  track_count: number
  has_cover: boolean
  sample_track_id: number
}

export interface Artist {
  name: string
  album_count: number
  track_count: number
}

export type SmartField = 'year' | 'genre' | 'decade' | 'often_played' | 'rarely_played'

export interface Playlist {
  id: number
  name: string
  track_count: number
  smart_field: SmartField | null
  smart_value: string | null
}

export interface FacetValue {
  value: string
  track_count: number
}

export interface PlaybackState {
  track_id: number | null
  position_seconds: number
  queue_track_ids: number[]
  volume?: number
}

export interface EqProfile {
  id: number
  name: string
  bands_db: number[]
}
