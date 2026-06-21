from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.security import get_current_user
from app.services.track_out import track_to_schema

router = APIRouter(prefix="/likes", tags=["likes"])


@router.get("", response_model=list[schemas.TrackOut])
def list_liked(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    rows = (
        db.query(models.Track)
        .join(models.Like, models.Like.track_id == models.Track.id)
        .filter(models.Like.user_id == user.id)
        .order_by(models.Like.created_at.desc())
        .all()
    )
    return [track_to_schema(t, liked=True) for t in rows]


@router.put("/{track_id}")
def like_track(track_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    track = db.get(models.Track, track_id)
    if not track or track.user_id != user.id:
        raise HTTPException(status_code=404, detail="Трек не найден")
    exists = db.query(models.Like).filter(models.Like.user_id == user.id, models.Like.track_id == track_id).first()
    if not exists:
        db.add(models.Like(user_id=user.id, track_id=track_id))
        db.commit()
    return {"status": "ok"}


@router.delete("/{track_id}")
def unlike_track(track_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    like = db.query(models.Like).filter(models.Like.user_id == user.id, models.Like.track_id == track_id).first()
    if like:
        db.delete(like)
        db.commit()
    return {"status": "ok"}
