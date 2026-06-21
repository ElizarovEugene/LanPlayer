import os
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.security import get_current_user, get_current_user_for_media
from app.services.scanner import scan_user_library
from app.services.coverart import fetch_missing_covers_for_user, resolve_track_cover_path
from app.services.fanart import fetch_missing_artist_photos_for_user, resolve_artist_photo_path
from app.services.streaming import range_file_response
from app.services.track_out import track_to_schema
from app.services.lyrics import get_lyrics_for_track

router = APIRouter(tags=["library"])


def _liked_track_ids(db: Session, user_id: int) -> set[int]:
    rows = db.query(models.Like.track_id).filter(models.Like.user_id == user_id).all()
    return {r[0] for r in rows}


def _track_out(track: models.Track, liked_ids: set[int]) -> schemas.TrackOut:
    return track_to_schema(track, liked=track.id in liked_ids)


@router.get("/library/songs", response_model=list[schemas.TrackOut])
def list_songs(
    search: str | None = None,
    limit: int = 200,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    query = db.query(models.Track).filter(models.Track.user_id == user.id)
    if search:
        like = f"%{search}%"
        query = query.filter(or_(
            models.Track.title.ilike(like),
            models.Track.artist.ilike(like),
            models.Track.album.ilike(like),
        ))
    tracks = query.order_by(models.Track.artist, models.Track.album, models.Track.track_no).offset(offset).limit(limit).all()
    liked_ids = _liked_track_ids(db, user.id)
    return [_track_out(t, liked_ids) for t in tracks]


@router.get("/library/recent", response_model=list[schemas.TrackOut])
def list_recent(
    days: int = 30,
    limit: int = 200,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    since = datetime.utcnow() - timedelta(days=days)
    tracks = (
        db.query(models.Track)
        .filter(models.Track.user_id == user.id, models.Track.created_at >= since)
        .order_by(models.Track.created_at.desc())
        .offset(offset).limit(limit).all()
    )
    liked_ids = _liked_track_ids(db, user.id)
    return [_track_out(t, liked_ids) for t in tracks]


@router.get("/library/radio", response_model=list[schemas.TrackOut])
def radio_tracks(
    limit: int = 50,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    tracks = (
        db.query(models.Track)
        .filter(models.Track.user_id == user.id)
        .order_by(func.random())
        .limit(limit)
        .all()
    )
    liked_ids = _liked_track_ids(db, user.id)
    return [_track_out(t, liked_ids) for t in tracks]


@router.get("/library/facets", response_model=list[schemas.FacetValue])
def list_facets(
    field: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if field == "year":
        column = models.Track.year
    elif field == "genre":
        column = models.Track.genre
    elif field == "decade":
        column = models.Track.year - (models.Track.year % 10)
        rows = (
            db.query(column, func.count(models.Track.id))
            .filter(models.Track.user_id == user.id, models.Track.year.isnot(None))
            .group_by(column)
            .order_by(column.desc())
            .all()
        )
        return [schemas.FacetValue(value=str(int(value)), track_count=count) for value, count in rows]
    else:
        raise HTTPException(status_code=400, detail="Недопустимое поле")

    rows = (
        db.query(column, func.count(models.Track.id))
        .filter(models.Track.user_id == user.id, column.isnot(None))
        .group_by(column)
        .order_by(column.desc() if field == "year" else column)
        .all()
    )
    return [schemas.FacetValue(value=str(value), track_count=count) for value, count in rows]


@router.get("/library/albums", response_model=list[schemas.AlbumOut])
def list_albums(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    rows = (
        db.query(
            models.Track.album,
            models.Track.album_artist,
            func.min(models.Track.year),
            func.count(models.Track.id),
            func.max(models.Track.cover_path),
            func.min(models.Track.id),
        )
        .filter(models.Track.user_id == user.id)
        .group_by(models.Track.album, models.Track.album_artist)
        .order_by(models.Track.album_artist, models.Track.album)
        .all()
    )
    return [
        schemas.AlbumOut(
            album=album, album_artist=album_artist or "", year=year, track_count=count,
            has_cover=bool(cover), sample_track_id=sample_track_id,
        )
        for album, album_artist, year, count, cover, sample_track_id in rows
    ]


@router.get("/library/albums/tracks", response_model=list[schemas.TrackOut])
def album_tracks(
    album: str,
    album_artist: str = "",
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    query = db.query(models.Track).filter(models.Track.user_id == user.id, models.Track.album == album)
    if album_artist:
        query = query.filter(models.Track.album_artist == album_artist)
    tracks = query.order_by(models.Track.track_no, models.Track.title).all()
    liked_ids = _liked_track_ids(db, user.id)
    return [_track_out(t, liked_ids) for t in tracks]


@router.get("/library/artists", response_model=list[schemas.ArtistOut])
def list_artists(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    rows = (
        db.query(
            func.lower(models.Track.artist),
            func.min(models.Track.artist),
            func.count(func.distinct(models.Track.album)),
            func.count(models.Track.id),
        )
        .filter(models.Track.user_id == user.id)
        .group_by(func.lower(models.Track.artist))
        .order_by(func.min(models.Track.artist))
        .all()
    )
    return [
        schemas.ArtistOut(name=display_name, album_count=albums, track_count=tracks)
        for _key, display_name, albums, tracks in rows
    ]


@router.get("/library/artists/tracks", response_model=list[schemas.TrackOut])
def artist_tracks(
    name: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    tracks = (
        db.query(models.Track)
        .filter(models.Track.user_id == user.id, func.lower(models.Track.artist) == name.lower())
        .order_by(models.Track.album, models.Track.track_no)
        .all()
    )
    liked_ids = _liked_track_ids(db, user.id)
    return [_track_out(t, liked_ids) for t in tracks]


@router.get("/tracks/by-ids", response_model=list[schemas.TrackOut])
def tracks_by_ids(
    ids: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    id_list = [int(x) for x in ids.split(",") if x.strip().isdigit()]
    tracks = db.query(models.Track).filter(models.Track.user_id == user.id, models.Track.id.in_(id_list)).all()
    by_id = {t.id: t for t in tracks}
    liked_ids = _liked_track_ids(db, user.id)
    return [_track_out(by_id[i], liked_ids) for i in id_list if i in by_id]


def _run_rescan(user_id: int) -> None:
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        user = db.get(models.User, user_id)
        if user:
            scan_user_library(db, user)
            fetch_missing_covers_for_user(db, user)
            fetch_missing_artist_photos_for_user(db, user)
    finally:
        db.close()


@router.post("/library/rescan")
def rescan(
    background_tasks: BackgroundTasks,
    user: models.User = Depends(get_current_user),
):
    background_tasks.add_task(_run_rescan, user.id)
    return {"status": "started"}


def _get_owned_track(db: Session, user: models.User, track_id: int) -> models.Track:
    track = db.get(models.Track, track_id)
    if not track or track.user_id != user.id:
        raise HTTPException(status_code=404, detail="Трек не найден")
    return track


@router.get("/tracks/{track_id}/stream")
def stream_track(
    track_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user_for_media),
):
    track = _get_owned_track(db, user, track_id)
    abs_path = os.path.join(user.library_path, track.path)
    if not os.path.isfile(abs_path):
        raise HTTPException(status_code=404, detail="Файл не найден на диске")
    return range_file_response(abs_path, request)


@router.get("/tracks/{track_id}/cover")
def track_cover(
    track_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user_for_media),
):
    track = _get_owned_track(db, user, track_id)
    cover_path = resolve_track_cover_path(db, track)
    if not cover_path or not os.path.isfile(cover_path):
        raise HTTPException(status_code=404, detail="Обложка недоступна")
    return FileResponse(cover_path, headers={"Cache-Control": "private, max-age=604800, immutable"})


@router.get("/tracks/{track_id}/lyrics", response_model=schemas.LyricsOut)
def track_lyrics(
    track_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    track = _get_owned_track(db, user, track_id)
    result = get_lyrics_for_track(db, user, track)
    if not result:
        return schemas.LyricsOut(found=False, synced=False, lines=[])
    return schemas.LyricsOut(
        found=True,
        synced=result.synced,
        lines=[schemas.LyricsLineOut(time=line.time, text=line.text) for line in result.lines],
    )


@router.get("/artists/photo")
def artist_photo(
    name: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user_for_media),
):
    photo_path = resolve_artist_photo_path(db, user.id, name)
    if not photo_path or not os.path.isfile(photo_path):
        raise HTTPException(status_code=404, detail="Фото недоступно")
    return FileResponse(photo_path, headers={"Cache-Control": "private, max-age=604800, immutable"})
