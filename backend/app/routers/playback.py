import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.security import get_current_user

router = APIRouter(prefix="/playback-state", tags=["playback"])


@router.get("", response_model=schemas.PlaybackStateOut)
def get_state(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    state = db.get(models.PlaybackState, user.id)
    if not state:
        return schemas.PlaybackStateOut(track_id=None, position_seconds=0, queue_track_ids=[], volume=0.7)
    return schemas.PlaybackStateOut(
        track_id=state.track_id,
        position_seconds=state.position_seconds,
        queue_track_ids=json.loads(state.queue_track_ids) if state.queue_track_ids else [],
        volume=state.volume,
    )


@router.put("", response_model=schemas.PlaybackStateOut)
def save_state(data: schemas.PlaybackStateIn, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    state = db.get(models.PlaybackState, user.id)
    if not state:
        state = models.PlaybackState(user_id=user.id)
        db.add(state)
    state.track_id = data.track_id
    state.position_seconds = data.position_seconds
    state.queue_track_ids = json.dumps(data.queue_track_ids)
    if data.volume is not None:
        state.volume = data.volume
    db.commit()
    return schemas.PlaybackStateOut(
        track_id=state.track_id,
        position_seconds=state.position_seconds,
        queue_track_ids=data.queue_track_ids,
        volume=state.volume,
    )
