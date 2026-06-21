from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Text, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    library_path: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Без FK-constraint: профиль и пользователь в SQLite иначе образуют
    # циклическую зависимость таблиц. Целостность обеспечивается в коде
    # (см. delete_profile в routers/eq.py).
    active_eq_profile_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    active_eq_preset_id: Mapped[str | None] = mapped_column(String(30), nullable=True)
    language: Mapped[str] = mapped_column(String(5), default="en")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    tracks: Mapped[list["Track"]] = relationship("Track", back_populates="user", cascade="all, delete-orphan")
    playlists: Mapped[list["Playlist"]] = relationship("Playlist", back_populates="user", cascade="all, delete-orphan")
    eq_profiles: Mapped[list["EqProfile"]] = relationship(
        "EqProfile", back_populates="user", cascade="all, delete-orphan", foreign_keys="EqProfile.user_id"
    )


class Track(Base):
    __tablename__ = "tracks"
    __table_args__ = (UniqueConstraint("user_id", "path", name="uq_track_user_path"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    path: Mapped[str] = mapped_column(Text, nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    mtime: Mapped[float] = mapped_column(Float, nullable=False)

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    artist: Mapped[str] = mapped_column(String(500), nullable=False)
    album: Mapped[str] = mapped_column(String(500), nullable=False)
    album_artist: Mapped[str | None] = mapped_column(String(500), nullable=True)
    track_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    genre: Mapped[str | None] = mapped_column(String(200), nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)

    cover_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="tracks")


class Playlist(Base):
    __tablename__ = "playlists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # Умный плейлист: состав вычисляется фильтром по полю трека, а не через
    # playlist_tracks. smart_field — "year" или "genre", smart_value — точное
    # значение этого поля.
    smart_field: Mapped[str | None] = mapped_column(String(20), nullable=True)
    smart_value: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="playlists")
    items: Mapped[list["PlaylistTrack"]] = relationship(
        "PlaylistTrack", back_populates="playlist", cascade="all, delete-orphan", order_by="PlaylistTrack.position"
    )


class PlaylistTrack(Base):
    __tablename__ = "playlist_tracks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    playlist_id: Mapped[int] = mapped_column(ForeignKey("playlists.id"), nullable=False)
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id"), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    playlist: Mapped["Playlist"] = relationship("Playlist", back_populates="items")
    track: Mapped["Track"] = relationship("Track")


class Like(Base):
    __tablename__ = "likes"
    __table_args__ = (UniqueConstraint("user_id", "track_id", name="uq_like_user_track"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class HistoryEntry(Base):
    __tablename__ = "history_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id"), nullable=False)
    played_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PlaybackState(Base):
    __tablename__ = "playback_state"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    track_id: Mapped[int | None] = mapped_column(ForeignKey("tracks.id"), nullable=True)
    position_seconds: Mapped[float] = mapped_column(Float, default=0)
    queue_track_ids: Mapped[str | None] = mapped_column(Text, nullable=True)
    volume: Mapped[float] = mapped_column(Float, default=0.7)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EqProfile(Base):
    __tablename__ = "eq_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    bands_db: Mapped[str] = mapped_column(Text, nullable=False)  # JSON array of gains in dB
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="eq_profiles", foreign_keys=[user_id])


class AlbumCoverLookup(Base):
    __tablename__ = "album_cover_lookups"
    __table_args__ = (UniqueConstraint("user_id", "artist_key", "album_key", name="uq_cover_lookup"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    artist_key: Mapped[str] = mapped_column(String(500), nullable=False)
    album_key: Mapped[str] = mapped_column(String(500), nullable=False)
    found: Mapped[bool] = mapped_column(Boolean, default=False)
    cover_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    looked_up_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ArtistPhotoLookup(Base):
    __tablename__ = "artist_photo_lookups"
    __table_args__ = (UniqueConstraint("user_id", "artist_key", name="uq_artist_photo_lookup"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    artist_key: Mapped[str] = mapped_column(String(500), nullable=False)
    mbid: Mapped[str | None] = mapped_column(String(40), nullable=True)
    found: Mapped[bool] = mapped_column(Boolean, default=False)
    photo_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    looked_up_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AppSetting(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    fanart_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)


class LyricsLookup(Base):
    __tablename__ = "lyrics_lookups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id"), unique=True, nullable=False)
    found: Mapped[bool] = mapped_column(Boolean, default=False)
    synced: Mapped[bool] = mapped_column(Boolean, default=False)
    lyrics_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String(20), nullable=True)
    looked_up_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
