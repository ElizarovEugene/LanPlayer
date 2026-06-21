import hashlib
import time
from pathlib import Path

import httpx
from sqlalchemy.orm import Session

from app import models
from app.config import settings

_MB_ARTIST_SEARCH_URL = "https://musicbrainz.org/ws/2/artist/"
_FANART_URL = "https://webservice.fanart.tv/v3/music/{mbid}"
_MUSICBRAINZ_RATE_LIMIT_SECONDS = 1.1

_ARTIST_PHOTOS_DIR = Path(settings.covers_dir) / "artists"


def get_fanart_api_key(db: Session) -> str:
    row = db.get(models.AppSetting, 1)
    if row and row.fanart_api_key:
        return row.fanart_api_key
    return settings.fanart_api_key


def _normalize_key(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _save_photo_bytes(data: bytes) -> str:
    _ARTIST_PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha1(data).hexdigest()
    out_path = _ARTIST_PHOTOS_DIR / f"{digest}.jpg"
    if not out_path.exists():
        out_path.write_bytes(data)
    return str(out_path)


def _resolve_artist_mbid(client: httpx.Client, artist: str) -> str | None:
    headers = {"User-Agent": settings.musicbrainz_user_agent}
    try:
        resp = client.get(
            _MB_ARTIST_SEARCH_URL,
            params={"query": f'artist:"{artist}"', "fmt": "json", "limit": 1},
            headers=headers,
        )
        resp.raise_for_status()
        artists = resp.json().get("artists") or []
        return artists[0]["id"] if artists else None
    except (httpx.HTTPError, KeyError, ValueError, IndexError):
        return None


def _fetch_fanart_photo(client: httpx.Client, mbid: str, api_key: str) -> str | None:
    if not api_key:
        return None
    try:
        resp = client.get(_FANART_URL.format(mbid=mbid), params={"api_key": api_key})
        if resp.status_code != 200:
            return None
        data = resp.json()
        candidates = data.get("artistthumb") or data.get("artistbackground") or []
        if not candidates:
            return None
        img_resp = client.get(candidates[0]["url"])
        if img_resp.status_code != 200:
            return None
        return _save_photo_bytes(img_resp.content)
    except (httpx.HTTPError, ValueError, KeyError, IndexError):
        return None


def fetch_missing_artist_photos_for_user(db: Session, user: models.User) -> None:
    """Best-effort: для исполнителей без фото ищет MusicBrainz ID, затем
    фото на fanart.tv, сохраняет локально и больше не повторяет запрос
    (даже если ничего не нашлось)."""
    api_key = get_fanart_api_key(db)
    if not api_key:
        return

    artists = [
        row[0] for row in
        db.query(models.Track.artist).filter(models.Track.user_id == user.id).distinct().all()
    ]
    if not artists:
        return

    with httpx.Client(timeout=15) as client:
        for artist in artists:
            artist_key = _normalize_key(artist)
            already = (
                db.query(models.ArtistPhotoLookup)
                .filter(models.ArtistPhotoLookup.user_id == user.id, models.ArtistPhotoLookup.artist_key == artist_key)
                .first()
            )
            if already is not None:
                continue

            mbid = _resolve_artist_mbid(client, artist)
            photo_path = _fetch_fanart_photo(client, mbid, api_key) if mbid else None
            db.add(models.ArtistPhotoLookup(
                user_id=user.id,
                artist_key=artist_key,
                mbid=mbid,
                found=photo_path is not None,
                photo_path=photo_path,
            ))
            db.commit()
            time.sleep(_MUSICBRAINZ_RATE_LIMIT_SECONDS)


def fetch_missing_artist_photos_all_users(db: Session) -> None:
    for user in db.query(models.User).filter(models.User.is_active == True, models.User.is_admin == False):  # noqa: E712
        fetch_missing_artist_photos_for_user(db, user)


def resolve_artist_photo_path(db: Session, user_id: int, artist: str) -> str | None:
    artist_key = _normalize_key(artist)
    lookup = (
        db.query(models.ArtistPhotoLookup)
        .filter(models.ArtistPhotoLookup.user_id == user_id, models.ArtistPhotoLookup.artist_key == artist_key)
        .first()
    )
    return lookup.photo_path if lookup and lookup.found else None
