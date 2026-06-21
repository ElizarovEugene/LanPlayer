from app import models, schemas


def track_to_schema(track: models.Track, liked: bool = False) -> schemas.TrackOut:
    return schemas.TrackOut(
        id=track.id,
        title=track.title,
        artist=track.artist,
        album=track.album,
        album_artist=track.album_artist,
        track_no=track.track_no,
        year=track.year,
        genre=track.genre,
        duration_seconds=track.duration_seconds,
        has_cover=bool(track.cover_path),
        liked=liked,
    )
