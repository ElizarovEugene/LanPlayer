from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    username: str
    library_path: str
    active_eq_profile_id: int | None
    active_eq_preset_id: str | None = None
    language: str = "en"
    is_admin: bool = False

    class Config:
        from_attributes = True


class UserLanguageUpdate(BaseModel):
    language: str


class AdminUserOut(BaseModel):
    id: int
    username: str
    library_path: str
    is_active: bool
    track_count: int


class AdminUserCreate(BaseModel):
    username: str
    password: str
    library_path: str


class AdminUserUpdate(BaseModel):
    password: str | None = None
    library_path: str | None = None
    is_active: bool | None = None


class ScanStatusOut(BaseModel):
    scanning: bool
    processed: int
    total: int


class AppSettingsOut(BaseModel):
    fanart_api_key: str


class AppSettingsIn(BaseModel):
    fanart_api_key: str


class TrackOut(BaseModel):
    id: int
    title: str
    artist: str
    album: str
    album_artist: str | None
    track_no: int | None
    year: int | None
    genre: str | None
    duration_seconds: float | None
    has_cover: bool
    liked: bool = False

    class Config:
        from_attributes = True


class AlbumOut(BaseModel):
    album: str
    album_artist: str
    year: int | None
    track_count: int
    has_cover: bool
    sample_track_id: int


class ArtistOut(BaseModel):
    name: str
    album_count: int
    track_count: int




class PlaylistOut(BaseModel):
    id: int
    name: str
    track_count: int
    smart_field: str | None = None
    smart_value: str | None = None

    class Config:
        from_attributes = True


class PlaylistCreate(BaseModel):
    name: str


class SmartPlaylistCreate(BaseModel):
    field: str  # "year" | "genre" | "decade" | "often_played" | "rarely_played"
    value: str
    name: str | None = None


class FacetValue(BaseModel):
    value: str
    track_count: int


class PlaylistAddTrack(BaseModel):
    track_id: int


class PlaylistReorder(BaseModel):
    track_ids: list[int]


class PlaylistImportResult(BaseModel):
    playlist: PlaylistOut
    matched: int
    unmatched: list[str]


class HistoryCreate(BaseModel):
    track_id: int
    played_ratio: float


class HistoryEntryOut(BaseModel):
    track: TrackOut
    played_at: str


class PlaybackStateIn(BaseModel):
    track_id: int | None = None
    position_seconds: float = 0
    queue_track_ids: list[int] = []
    volume: float | None = None


class PlaybackStateOut(BaseModel):
    track_id: int | None
    position_seconds: float
    queue_track_ids: list[int]
    volume: float


class EqProfileCreate(BaseModel):
    name: str
    bands_db: list[float]


class EqProfileOut(BaseModel):
    id: int
    name: str
    bands_db: list[float]


class LyricsLineOut(BaseModel):
    time: float | None
    text: str


class LyricsOut(BaseModel):
    found: bool
    synced: bool
    lines: list[LyricsLineOut]
