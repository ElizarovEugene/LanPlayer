import hashlib
import re
import time
from pathlib import Path

import httpx
from sqlalchemy import distinct
from sqlalchemy.orm import Session

from app import models
from app.config import settings

_MB_SEARCH_URL = "https://musicbrainz.org/ws/2/release/"
_CAA_FRONT_URL = "https://coverartarchive.org/release/{mbid}/front"
_MUSICBRAINZ_RATE_LIMIT_SECONDS = 1.1

_DISCOGS_SEARCH_URL = "https://api.discogs.com/database/search"
_DISCOGS_RELEASE_URL = "https://api.discogs.com/releases/{release_id}"
_DISCOGS_RATE_LIMIT_SECONDS = 2.5

_MUSICBRAINZ_COVERS_DIR = Path(settings.covers_dir) / "musicbrainz"
_TRAILING_PARENTHETICAL = re.compile(r"^(.*?)\s*\([^)]*\)\s*$")


def _normalize_key(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _save_cover_bytes(data: bytes) -> str:
    _MUSICBRAINZ_COVERS_DIR.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha1(data).hexdigest()
    out_path = _MUSICBRAINZ_COVERS_DIR / f"{digest}.jpg"
    if not out_path.exists():
        out_path.write_bytes(data)
    return str(out_path)


def _search_release_mbids(client: httpx.Client, artist: str, album: str) -> list[str]:
    headers = {"User-Agent": settings.musicbrainz_user_agent}
    query = f'release:"{album}" AND artist:"{artist}"'
    try:
        resp = client.get(_MB_SEARCH_URL, params={"query": query, "fmt": "json", "limit": 5}, headers=headers)
        resp.raise_for_status()
        releases = resp.json().get("releases") or []
        return [r["id"] for r in releases]
    except (httpx.HTTPError, KeyError, ValueError):
        return []


def _fetch_caa_front(client: httpx.Client, mbid: str) -> str | None:
    headers = {"User-Agent": settings.musicbrainz_user_agent}
    try:
        img_resp = client.get(_CAA_FRONT_URL.format(mbid=mbid), headers=headers, follow_redirects=True)
        if img_resp.status_code != 200:
            return None
        return _save_cover_bytes(img_resp.content)
    except httpx.HTTPError:
        return None


def _lookup_musicbrainz_cover(client: httpx.Client, artist: str, album: str) -> str | None:
    mbids = _search_release_mbids(client, artist, album)
    if not mbids:
        # Локальные имена папок/тегов часто содержат суффиксы вида "(EP)",
        # "(Single)", "(Deluxe Edition)", которых нет в каноническом
        # названии релиза на MusicBrainz — пробуем без них.
        match = _TRAILING_PARENTHETICAL.match(album)
        if match and match.group(1):
            time.sleep(_MUSICBRAINZ_RATE_LIMIT_SECONDS)
            mbids = _search_release_mbids(client, artist, match.group(1))

    # Разные издания одного релиза по-разному обложены на Cover Art Archive —
    # самый релевантный результат поиска может не иметь обложки, тогда как
    # следующий по релевантности её содержит. Пробуем по очереди.
    for mbid in mbids:
        cover_path = _fetch_caa_front(client, mbid)
        if cover_path:
            return cover_path
    return None


def _discogs_album_candidates(album: str) -> list[str]:
    candidates = [album.lower()]
    match = _TRAILING_PARENTHETICAL.match(album)
    if match and match.group(1):
        candidates.append(match.group(1).lower())
    return candidates


def _search_discogs_release_id(client: httpx.Client, artist: str, album: str) -> int | None:
    headers = {"User-Agent": settings.musicbrainz_user_agent}
    try:
        resp = client.get(
            _DISCOGS_SEARCH_URL,
            params={"q": f"{artist} {album}", "type": "release"},
            headers=headers,
        )
        resp.raise_for_status()
        results = resp.json().get("results") or []
    except (httpx.HTTPError, KeyError, ValueError):
        return None

    artist_lower = artist.lower()
    album_candidates = _discogs_album_candidates(album)

    # Discogs форматирует найденные релизы как "Артист - Название", без
    # надёжного отдельного поля артиста в выдаче поиска — разбираем сами.
    # Принимаем результат только если совпали И артист, И альбом (или его
    # вариант без "(EP)"/"(Single)" и т.п.) — иначе лучше не найти обложку
    # вовсе, чем взять обложку совершенно другого релиза.
    for r in results:
        title = (r.get("title") or "").lower()
        artist_part, _, album_part = title.partition(" - ")
        if not album_part:
            continue
        if artist_lower not in artist_part:
            continue
        if any(cand in album_part or album_part in cand for cand in album_candidates):
            return r["id"]
    return None


def _fetch_discogs_cover(client: httpx.Client, release_id: int) -> str | None:
    headers = {"User-Agent": settings.musicbrainz_user_agent}
    try:
        resp = client.get(_DISCOGS_RELEASE_URL.format(release_id=release_id), headers=headers)
        resp.raise_for_status()
        images = resp.json().get("images") or []
        if not images:
            return None
        img_url = images[0].get("uri") or images[0].get("resource_url")
        if not img_url:
            return None
        img_resp = client.get(img_url, headers=headers, follow_redirects=True)
        if img_resp.status_code != 200:
            return None
        return _save_cover_bytes(img_resp.content)
    except (httpx.HTTPError, KeyError, ValueError, IndexError):
        return None


def _lookup_discogs_cover(client: httpx.Client, artist: str, album: str) -> str | None:
    """Запасной источник для редких/локальных релизов, которых нет на
    MusicBrainz — у Discogs гораздо шире покрытие небольших и любительских
    изданий."""
    time.sleep(_DISCOGS_RATE_LIMIT_SECONDS)
    release_id = _search_discogs_release_id(client, artist, album)
    if release_id is None:
        return None
    time.sleep(_DISCOGS_RATE_LIMIT_SECONDS)
    return _fetch_discogs_cover(client, release_id)


def fetch_missing_covers_for_user(db: Session, user: models.User) -> None:
    """Best-effort: для альбомов без своей обложки спрашивает MusicBrainz +
    Cover Art Archive, сохраняет картинку локально и больше не повторяет
    запрос для этого альбома (даже если ничего не нашлось)."""
    rows = (
        db.query(distinct(models.Track.album_artist), models.Track.album)
        .filter(models.Track.user_id == user.id, models.Track.cover_path.is_(None))
        .all()
    )
    if not rows:
        return

    with httpx.Client(timeout=10) as client:
        for album_artist, album in rows:
            artist = album_artist or ""
            artist_key = _normalize_key(artist)
            album_key = _normalize_key(album)

            already = (
                db.query(models.AlbumCoverLookup)
                .filter(
                    models.AlbumCoverLookup.user_id == user.id,
                    models.AlbumCoverLookup.artist_key == artist_key,
                    models.AlbumCoverLookup.album_key == album_key,
                )
                .first()
            )
            if already is not None:
                continue

            cover_path = _lookup_musicbrainz_cover(client, artist, album)
            if cover_path is None:
                cover_path = _lookup_discogs_cover(client, artist, album)
            db.add(models.AlbumCoverLookup(
                user_id=user.id,
                artist_key=artist_key,
                album_key=album_key,
                found=cover_path is not None,
                cover_path=cover_path,
            ))
            db.commit()
            time.sleep(_MUSICBRAINZ_RATE_LIMIT_SECONDS)


def fetch_missing_covers_all_users(db: Session) -> None:
    for user in db.query(models.User).filter(models.User.is_active == True, models.User.is_admin == False):  # noqa: E712
        fetch_missing_covers_for_user(db, user)


def resolve_track_cover_path(db: Session, track: models.Track) -> str | None:
    if track.cover_path:
        return track.cover_path
    artist_key = _normalize_key(track.album_artist or track.artist)
    album_key = _normalize_key(track.album)
    lookup = (
        db.query(models.AlbumCoverLookup)
        .filter(
            models.AlbumCoverLookup.user_id == track.user_id,
            models.AlbumCoverLookup.artist_key == artist_key,
            models.AlbumCoverLookup.album_key == album_key,
        )
        .first()
    )
    return lookup.cover_path if lookup and lookup.found else None
