from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.security import get_current_user
from app.services.track_out import track_to_schema

router = APIRouter(prefix="/playlists", tags=["playlists"])

SMART_FIELD_LABELS = {
    "ru": {"year": "Год", "genre": "Жанр", "decade": "Десятилетие"},
    "en": {"year": "Year", "genre": "Genre", "decade": "Decade"},
}
VALID_SMART_FIELDS = {"year", "genre", "decade", "often_played", "rarely_played"}
OFTEN_PLAYED_THRESHOLD = 5
RARELY_PLAYED_THRESHOLD = 1


def _default_smart_name(field: str, value: str, language: str) -> str:
    labels = SMART_FIELD_LABELS.get(language, SMART_FIELD_LABELS["ru"])
    if field == "often_played":
        return "Часто слушаемые" if language == "ru" else "Often played"
    if field == "rarely_played":
        return "Редко слушаемые" if language == "ru" else "Rarely played"
    if field == "decade":
        return f"{value}-е" if language == "ru" else f"{value}s"
    return f"{labels.get(field, field)}: {value}"


def _find_track_by_m3u_path(
    raw_path: str,
    by_path: dict[str, "models.Track"],
    by_basename: dict[str, list["models.Track"]],
) -> "models.Track | None":
    normalized = raw_path.replace("\\", "/").strip()
    if not normalized:
        return None
    if normalized in by_path:
        return by_path[normalized]
    for rel_path, track in by_path.items():
        if normalized.endswith(rel_path):
            return track
    basename = normalized.rsplit("/", 1)[-1]
    candidates = by_basename.get(basename, [])
    return candidates[0] if len(candidates) == 1 else None


def _get_owned_playlist(db: Session, user: models.User, playlist_id: int) -> models.Playlist:
    playlist = db.get(models.Playlist, playlist_id)
    if not playlist or playlist.user_id != user.id:
        raise HTTPException(status_code=404, detail="Плейлист не найден")
    return playlist


def _play_counts_subquery(db: Session, user_id: int):
    return (
        db.query(
            models.HistoryEntry.track_id.label("track_id"),
            func.count(models.HistoryEntry.id).label("play_count"),
        )
        .filter(models.HistoryEntry.user_id == user_id)
        .group_by(models.HistoryEntry.track_id)
        .subquery()
    )


def _smart_query(db: Session, user_id: int, field: str, value: str):
    query = db.query(models.Track).filter(models.Track.user_id == user_id)
    if field == "year":
        try:
            year = int(value)
        except ValueError:
            return query.filter(False)
        return query.filter(models.Track.year == year)
    if field == "genre":
        return query.filter(models.Track.genre.ilike(value))
    if field == "decade":
        try:
            decade_start = int(value)
        except ValueError:
            return query.filter(False)
        return query.filter(
            models.Track.year >= decade_start,
            models.Track.year < decade_start + 10,
        )
    if field == "often_played":
        counts = _play_counts_subquery(db, user_id)
        return query.join(counts, counts.c.track_id == models.Track.id).filter(
            counts.c.play_count >= OFTEN_PLAYED_THRESHOLD
        )
    if field == "rarely_played":
        counts = _play_counts_subquery(db, user_id)
        return query.outerjoin(counts, counts.c.track_id == models.Track.id).filter(
            or_(counts.c.play_count.is_(None), counts.c.play_count <= RARELY_PLAYED_THRESHOLD)
        )
    return query.filter(False)


def _playlist_track_count(db: Session, user_id: int, playlist: models.Playlist) -> int:
    if playlist.smart_field:
        return _smart_query(db, user_id, playlist.smart_field, playlist.smart_value).count()
    return len(playlist.items)


def _resolve_playlist_tracks(db: Session, user_id: int, playlist: models.Playlist) -> list[models.Track]:
    if playlist.smart_field:
        return _smart_query(db, user_id, playlist.smart_field, playlist.smart_value).order_by(
            models.Track.artist, models.Track.album, models.Track.track_no
        ).all()
    return [item.track for item in playlist.items]


def _playlist_out(db: Session, user_id: int, playlist: models.Playlist) -> schemas.PlaylistOut:
    return schemas.PlaylistOut(
        id=playlist.id, name=playlist.name,
        track_count=_playlist_track_count(db, user_id, playlist),
        smart_field=playlist.smart_field, smart_value=playlist.smart_value,
    )


@router.get("", response_model=list[schemas.PlaylistOut])
def list_playlists(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    playlists = db.query(models.Playlist).filter(models.Playlist.user_id == user.id).order_by(models.Playlist.name).all()
    return [_playlist_out(db, user.id, p) for p in playlists]


@router.post("", response_model=schemas.PlaylistOut)
def create_playlist(data: schemas.PlaylistCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    playlist = models.Playlist(user_id=user.id, name=data.name)
    db.add(playlist)
    db.commit()
    return _playlist_out(db, user.id, playlist)


@router.post("/smart", response_model=schemas.PlaylistOut)
def create_smart_playlist(data: schemas.SmartPlaylistCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if data.field not in VALID_SMART_FIELDS:
        raise HTTPException(status_code=400, detail="Недопустимое поле для умного плейлиста")
    name = data.name or _default_smart_name(data.field, data.value, user.language)
    playlist = models.Playlist(user_id=user.id, name=name, smart_field=data.field, smart_value=data.value)
    db.add(playlist)
    db.commit()
    return _playlist_out(db, user.id, playlist)


@router.delete("/{playlist_id}")
def delete_playlist(playlist_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    playlist = _get_owned_playlist(db, user, playlist_id)
    db.delete(playlist)
    db.commit()
    return {"status": "ok"}


@router.put("/{playlist_id}", response_model=schemas.PlaylistOut)
def rename_playlist(playlist_id: int, data: schemas.PlaylistCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    playlist = _get_owned_playlist(db, user, playlist_id)
    playlist.name = data.name
    db.commit()
    return _playlist_out(db, user.id, playlist)


@router.get("/{playlist_id}/tracks", response_model=list[schemas.TrackOut])
def playlist_tracks(playlist_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    playlist = _get_owned_playlist(db, user, playlist_id)
    liked_ids = {r[0] for r in db.query(models.Like.track_id).filter(models.Like.user_id == user.id).all()}
    tracks = _resolve_playlist_tracks(db, user.id, playlist)
    return [track_to_schema(t, liked=t.id in liked_ids) for t in tracks]


@router.get("/{playlist_id}/export.m3u")
def export_m3u(playlist_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    playlist = _get_owned_playlist(db, user, playlist_id)
    tracks = _resolve_playlist_tracks(db, user.id, playlist)

    lines = ["#EXTM3U"]
    for t in tracks:
        duration = int(t.duration_seconds) if t.duration_seconds else -1
        lines.append(f"#EXTINF:{duration},{t.artist} - {t.title}")
        lines.append(t.path)
    content = "\n".join(lines) + "\n"

    filename = quote(f"{playlist.name}.m3u")
    return PlainTextResponse(
        content,
        media_type="audio/x-mpegurl",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )


@router.post("/import", response_model=schemas.PlaylistImportResult)
async def import_m3u(
    file: UploadFile = File(...),
    name: str | None = Form(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    raw = await file.read()
    text = raw.decode("utf-8", errors="replace")
    lines = [line.strip() for line in text.splitlines() if line.strip() and not line.startswith("#")]

    user_tracks = db.query(models.Track).filter(models.Track.user_id == user.id).all()
    by_path: dict[str, models.Track] = {}
    by_basename: dict[str, list[models.Track]] = {}
    for t in user_tracks:
        norm_path = t.path.replace("\\", "/")
        by_path[norm_path] = t
        by_basename.setdefault(norm_path.rsplit("/", 1)[-1], []).append(t)

    matched: list[models.Track] = []
    unmatched: list[str] = []
    seen_ids: set[int] = set()
    for line in lines:
        track = _find_track_by_m3u_path(line, by_path, by_basename)
        if track and track.id not in seen_ids:
            matched.append(track)
            seen_ids.add(track.id)
        elif not track:
            unmatched.append(line)

    default_name = file.filename.rsplit(".", 1)[0] if file.filename else "Импортированный плейлист"
    playlist = models.Playlist(user_id=user.id, name=name or default_name)
    db.add(playlist)
    db.flush()
    for position, track in enumerate(matched):
        db.add(models.PlaylistTrack(playlist_id=playlist.id, track_id=track.id, position=position))
    db.commit()

    return schemas.PlaylistImportResult(
        playlist=_playlist_out(db, user.id, playlist),
        matched=len(matched),
        unmatched=unmatched,
    )


@router.post("/{playlist_id}/tracks")
def add_track(playlist_id: int, data: schemas.PlaylistAddTrack, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    playlist = _get_owned_playlist(db, user, playlist_id)
    if playlist.smart_field:
        raise HTTPException(status_code=400, detail="Состав умного плейлиста определяется автоматически")
    track = db.get(models.Track, data.track_id)
    if not track or track.user_id != user.id:
        raise HTTPException(status_code=404, detail="Трек не найден")
    next_position = len(playlist.items)
    db.add(models.PlaylistTrack(playlist_id=playlist.id, track_id=track.id, position=next_position))
    db.commit()
    return {"status": "ok"}


@router.delete("/{playlist_id}/tracks/{track_id}")
def remove_track(playlist_id: int, track_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    playlist = _get_owned_playlist(db, user, playlist_id)
    if playlist.smart_field:
        raise HTTPException(status_code=400, detail="Состав умного плейлиста определяется автоматически")
    item = next((i for i in playlist.items if i.track_id == track_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Трек не найден в плейлисте")
    db.delete(item)
    db.commit()
    for index, remaining in enumerate(sorted((i for i in playlist.items if i.id != item.id), key=lambda i: i.position)):
        remaining.position = index
    db.commit()
    return {"status": "ok"}


@router.put("/{playlist_id}/order")
def reorder(playlist_id: int, data: schemas.PlaylistReorder, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    playlist = _get_owned_playlist(db, user, playlist_id)
    if playlist.smart_field:
        raise HTTPException(status_code=400, detail="Состав умного плейлиста определяется автоматически")
    items_by_track = {i.track_id: i for i in playlist.items}
    if set(data.track_ids) != set(items_by_track.keys()):
        raise HTTPException(status_code=400, detail="Список треков не совпадает с плейлистом")
    for position, track_id in enumerate(data.track_ids):
        items_by_track[track_id].position = position
    db.commit()
    return {"status": "ok"}
