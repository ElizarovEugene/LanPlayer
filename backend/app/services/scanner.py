import base64
import os
import hashlib
from pathlib import Path

import mutagen
from sqlalchemy.orm import Session

from app import models, scan_progress
from app.config import settings

AUDIO_EXTENSIONS = {".mp3", ".flac", ".ogg", ".opus", ".m4a", ".aac", ".wav"}
COVER_FILENAMES = {"cover.jpg", "cover.jpeg", "cover.png", "folder.jpg", "folder.jpeg", "folder.png"}

_EMBEDDED_COVERS_DIR = Path(settings.covers_dir) / "embedded"


def _read_easy_tags(path: str) -> dict:
    try:
        audio = mutagen.File(path, easy=True)
    except Exception:
        audio = None
    if audio is None:
        return {}
    tags = audio.tags or {}

    def first(key: str) -> str | None:
        values = tags.get(key)
        return values[0] if values else None

    duration = None
    if getattr(audio, "info", None) is not None:
        duration = getattr(audio.info, "length", None)

    track_no = first("tracknumber")
    if track_no:
        track_no = track_no.split("/")[0].strip()

    year = first("date")
    if year:
        year = year[:4]

    return {
        "title": first("title"),
        "artist": first("artist"),
        "album": first("album"),
        "album_artist": first("albumartist"),
        "track_no": int(track_no) if track_no and track_no.isdigit() else None,
        "year": int(year) if year and year.isdigit() else None,
        "genre": first("genre"),
        "duration_seconds": duration,
    }


def _extract_embedded_cover_bytes(path: str) -> bytes | None:
    try:
        audio = mutagen.File(path)
    except Exception:
        return None
    if audio is None:
        return None

    pictures = getattr(audio, "pictures", None)
    if pictures:
        return pictures[0].data

    tags = getattr(audio, "tags", None)
    if not tags:
        return None

    try:
        keys = list(tags.keys())
    except Exception:
        return None

    for key in keys:
        if str(key).startswith("APIC"):
            return tags[key].data
        if str(key).lower() == "metadata_block_picture":
            from mutagen.flac import Picture
            raw = tags[key]
            raw = raw[0] if isinstance(raw, list) else raw
            try:
                return Picture(base64.b64decode(raw)).data
            except Exception:
                return None

    if "covr" in tags:
        covr = tags["covr"]
        if covr:
            return bytes(covr[0])

    return None


def _save_embedded_cover(data: bytes) -> str:
    _EMBEDDED_COVERS_DIR.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha1(data).hexdigest()
    out_path = _EMBEDDED_COVERS_DIR / f"{digest}.jpg"
    if not out_path.exists():
        out_path.write_bytes(data)
    return str(out_path)


def _find_folder_cover(dir_path: str) -> str | None:
    try:
        entries = {e.lower(): e for e in os.listdir(dir_path)}
    except OSError:
        return None
    for name in COVER_FILENAMES:
        if name in entries:
            return os.path.join(dir_path, entries[name])
    return None


def _count_audio_files(root: str) -> int:
    count = 0
    for _dirpath, _dirnames, filenames in os.walk(root):
        for filename in filenames:
            if os.path.splitext(filename)[1].lower() in AUDIO_EXTENSIONS:
                count += 1
    return count


def scan_user_library(db: Session, user: models.User) -> None:
    """Полный обход библиотеки пользователя: добавляет новые/изменённые
    треки, удаляет записи о файлах, которых больше нет."""
    root = user.library_path
    if not os.path.isdir(root):
        return

    total = _count_audio_files(root)
    scan_progress.start(user.id, total)
    processed = 0

    try:
        existing = {t.path: t for t in db.query(models.Track).filter(models.Track.user_id == user.id)}
        seen_paths: set[str] = set()
        processed_since_commit = 0

        for dirpath, _dirnames, filenames in os.walk(root):
            folder_cover = None
            for filename in filenames:
                ext = os.path.splitext(filename)[1].lower()
                if ext not in AUDIO_EXTENSIONS:
                    continue

                abs_path = os.path.join(dirpath, filename)
                rel_path = os.path.relpath(abs_path, root)
                seen_paths.add(rel_path)

                processed += 1
                scan_progress.update(user.id, processed)

                try:
                    stat = os.stat(abs_path)
                except OSError:
                    continue

                track = existing.get(rel_path)
                if track and track.size == stat.st_size and track.mtime == stat.st_mtime:
                    continue

                tags = _read_easy_tags(abs_path)
                cover_path = None
                cover_bytes = _extract_embedded_cover_bytes(abs_path)
                if cover_bytes:
                    cover_path = _save_embedded_cover(cover_bytes)
                else:
                    if folder_cover is None:
                        folder_cover = _find_folder_cover(dirpath) or ""
                    cover_path = folder_cover or None

                fallback_title = os.path.splitext(filename)[0]
                fallback_album = os.path.basename(dirpath)
                fallback_artist = os.path.basename(os.path.dirname(dirpath))

                if track is None:
                    track = models.Track(user_id=user.id, path=rel_path, size=stat.st_size, mtime=stat.st_mtime)
                    db.add(track)
                else:
                    track.size = stat.st_size
                    track.mtime = stat.st_mtime

                track.title = tags.get("title") or fallback_title
                track.artist = tags.get("artist") or fallback_artist
                track.album = tags.get("album") or fallback_album
                track.album_artist = tags.get("album_artist") or tags.get("artist") or fallback_artist
                track.track_no = tags.get("track_no")
                track.year = tags.get("year")
                track.genre = tags.get("genre")
                track.duration_seconds = tags.get("duration_seconds")
                track.cover_path = cover_path

                processed_since_commit += 1
                if processed_since_commit >= 300:
                    db.commit()
                    processed_since_commit = 0

        for rel_path, track in existing.items():
            if rel_path not in seen_paths:
                db.delete(track)

        db.commit()
    finally:
        scan_progress.finish(user.id)


def scan_all_users(db: Session) -> None:
    for user in db.query(models.User).filter(models.User.is_active == True, models.User.is_admin == False):  # noqa: E712
        scan_user_library(db, user)
