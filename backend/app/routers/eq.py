import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.security import get_current_user

router = APIRouter(prefix="/eq-profiles", tags=["eq"])


def _out(p: models.EqProfile) -> schemas.EqProfileOut:
    return schemas.EqProfileOut(id=p.id, name=p.name, bands_db=json.loads(p.bands_db))


@router.get("", response_model=list[schemas.EqProfileOut])
def list_profiles(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    profiles = db.query(models.EqProfile).filter(models.EqProfile.user_id == user.id).order_by(models.EqProfile.name).all()
    return [_out(p) for p in profiles]


@router.post("", response_model=schemas.EqProfileOut)
def create_profile(data: schemas.EqProfileCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    profile = models.EqProfile(user_id=user.id, name=data.name, bands_db=json.dumps(data.bands_db))
    db.add(profile)
    db.commit()
    return _out(profile)


@router.put("/active/{profile_id}")
def set_active_profile(profile_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    profile = db.get(models.EqProfile, profile_id)
    if not profile or profile.user_id != user.id:
        raise HTTPException(status_code=404, detail="Профиль не найден")
    user.active_eq_profile_id = profile.id
    user.active_eq_preset_id = None
    db.commit()
    return {"status": "ok"}


@router.put("/active-preset/{preset_id}")
def set_active_preset(preset_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    user.active_eq_preset_id = preset_id
    user.active_eq_profile_id = None
    db.commit()
    return {"status": "ok"}


@router.delete("/active")
def clear_active_profile(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    user.active_eq_profile_id = None
    user.active_eq_preset_id = None
    db.commit()
    return {"status": "ok"}


@router.delete("/{profile_id}")
def delete_profile(profile_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    profile = db.get(models.EqProfile, profile_id)
    if not profile or profile.user_id != user.id:
        raise HTTPException(status_code=404, detail="Профиль не найден")
    if user.active_eq_profile_id == profile.id:
        user.active_eq_profile_id = None
    db.delete(profile)
    db.commit()
    return {"status": "ok"}
