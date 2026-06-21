from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.security import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])


def _get_or_create(db: Session) -> models.AppSetting:
    row = db.get(models.AppSetting, 1)
    if not row:
        row = models.AppSetting(id=1)
        db.add(row)
        db.commit()
    return row


def _mask(key: str) -> str:
    if not key:
        return ""
    return f"{'•' * max(len(key) - 4, 0)}{key[-4:]}"


@router.get("", response_model=schemas.AppSettingsOut)
def get_settings(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    row = _get_or_create(db)
    return schemas.AppSettingsOut(fanart_api_key=_mask(row.fanart_api_key or ""))


@router.put("", response_model=schemas.AppSettingsOut)
def update_settings(data: schemas.AppSettingsIn, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    row = _get_or_create(db)
    if data.fanart_api_key.strip():
        row.fanart_api_key = data.fanart_api_key.strip()
        db.commit()
    return schemas.AppSettingsOut(fanart_api_key=_mask(row.fanart_api_key or ""))
