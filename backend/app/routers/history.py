from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.security import get_current_user
from app.config import settings
from app.services.track_out import track_to_schema

router = APIRouter(prefix="/history", tags=["history"])


@router.post("")
def log_play(data: schemas.HistoryCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    track = db.get(models.Track, data.track_id)
    if not track or track.user_id != user.id:
        raise HTTPException(status_code=404, detail="Трек не найден")
    if data.played_ratio >= settings.history_min_played_ratio:
        db.add(models.HistoryEntry(user_id=user.id, track_id=data.track_id))
        db.commit()
    return {"status": "ok"}


@router.get("", response_model=list[schemas.HistoryEntryOut])
def list_history(limit: int = 100, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    rows = (
        db.query(models.HistoryEntry)
        .filter(models.HistoryEntry.user_id == user.id)
        .order_by(models.HistoryEntry.played_at.desc())
        .limit(limit)
        .all()
    )
    out = []
    for entry in rows:
        t = db.get(models.Track, entry.track_id)
        if not t:
            continue
        out.append(schemas.HistoryEntryOut(
            track=track_to_schema(t),
            played_at=entry.played_at.isoformat(),
        ))
    return out
