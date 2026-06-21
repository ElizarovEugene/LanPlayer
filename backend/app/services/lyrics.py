import os
import re
from dataclasses import dataclass

import httpx
from sqlalchemy.orm import Session

from app import models
from app.config import settings

_LRC_TIME_RE = re.compile(r"\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]")
_LRCLIB_URL = "https://lrclib.net/api/get"


@dataclass
class LyricsLine:
    time: float | None
    text: str


@dataclass
class ParsedLyrics:
    synced: bool
    lines: list[LyricsLine]
    raw_text: str


def _parse_lrc(text: str) -> ParsedLyrics:
    lines: list[LyricsLine] = []
    any_timed = False
    for raw_line in text.splitlines():
        raw_line = raw_line.strip()
        if not raw_line:
            continue
        matches = list(_LRC_TIME_RE.finditer(raw_line))
        if matches:
            any_timed = True
            content = _LRC_TIME_RE.sub("", raw_line).strip()
            if not content:
                continue
            for m in matches:
                minutes, seconds, frac = m.groups()
                t = int(minutes) * 60 + int(seconds)
                if frac:
                    t += int(frac.ljust(3, "0")) / 1000
                lines.append(LyricsLine(time=t, text=content))
        elif raw_line.startswith("[") and len(raw_line) > 1 and not raw_line[1].isdigit():
            # метаданные вида [ar:Artist]/[ti:Title] — не строка текста
            continue
        else:
            lines.append(LyricsLine(time=None, text=raw_line))
    lines.sort(key=lambda l: (l.time is None, l.time or 0))
    return ParsedLyrics(synced=any_timed, lines=lines, raw_text=text)


def _read_local_lrc(library_path: str, track_rel_path: str) -> ParsedLyrics | None:
    base, _ext = os.path.splitext(track_rel_path)
    lrc_path = os.path.join(library_path, base + ".lrc")
    if not os.path.isfile(lrc_path):
        return None
    try:
        with open(lrc_path, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
    except OSError:
        return None
    return _parse_lrc(text)


def _fetch_lrclib(track: models.Track) -> ParsedLyrics | None:
    params = {"track_name": track.title, "artist_name": track.artist}
    if track.album:
        params["album_name"] = track.album
    if track.duration_seconds:
        params["duration"] = int(track.duration_seconds)
    headers = {"User-Agent": settings.musicbrainz_user_agent}
    try:
        with httpx.Client(timeout=25) as client:
            resp = client.get(_LRCLIB_URL, params=params, headers=headers)
            if resp.status_code != 200:
                return None
            data = resp.json()
    except (httpx.HTTPError, ValueError):
        return None

    synced_text = data.get("syncedLyrics")
    if synced_text:
        return _parse_lrc(synced_text)
    plain_text = data.get("plainLyrics")
    if plain_text:
        lines = [LyricsLine(time=None, text=line) for line in plain_text.splitlines() if line.strip()]
        return ParsedLyrics(synced=False, lines=lines, raw_text=plain_text)
    return None


def get_lyrics_for_track(db: Session, user: models.User, track: models.Track) -> ParsedLyrics | None:
    """Сначала ищем .lrc-файл рядом с треком (всегда заново — он может
    появиться/измениться на шаре), и только если его нет — идём в lrclib.net
    с кэшированием результата (в т.ч. отрицательного) в БД."""
    local = _read_local_lrc(user.library_path, track.path)
    if local:
        return local

    cached = db.query(models.LyricsLookup).filter(models.LyricsLookup.track_id == track.id).first()
    if cached is not None:
        if not cached.found or not cached.lyrics_text:
            return None
        return _parse_lrc(cached.lyrics_text) if cached.synced else ParsedLyrics(
            synced=False,
            lines=[LyricsLine(time=None, text=line) for line in cached.lyrics_text.splitlines() if line.strip()],
            raw_text=cached.lyrics_text,
        )

    result = _fetch_lrclib(track)
    db.add(models.LyricsLookup(
        track_id=track.id,
        found=result is not None,
        synced=result.synced if result else False,
        lyrics_text=result.raw_text if result else None,
        source="lrclib" if result else None,
    ))
    db.commit()
    return result
