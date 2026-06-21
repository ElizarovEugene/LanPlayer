from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app import models, schemas, scan_progress
from app.security import hash_password, require_admin
from app.services.scanner import scan_user_library

router = APIRouter(prefix="/admin/users", tags=["admin"])


def _out(db: Session, user: models.User) -> schemas.AdminUserOut:
    track_count = db.query(models.Track).filter(models.Track.user_id == user.id).count()
    return schemas.AdminUserOut(
        id=user.id,
        username=user.username,
        library_path=user.library_path,
        is_active=user.is_active,
        track_count=track_count,
    )


@router.get("", response_model=list[schemas.AdminUserOut])
def list_users(db: Session = Depends(get_db), _admin: models.User = Depends(require_admin)):
    users = db.query(models.User).filter(models.User.is_admin == False).order_by(models.User.username).all()  # noqa: E712
    return [_out(db, u) for u in users]


@router.post("", response_model=schemas.AdminUserOut)
def create_user(data: schemas.AdminUserCreate, db: Session = Depends(get_db), _admin: models.User = Depends(require_admin)):
    if db.query(models.User).filter(models.User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Пользователь с таким именем уже существует")
    user = models.User(
        username=data.username,
        password_hash=hash_password(data.password),
        library_path=data.library_path,
    )
    db.add(user)
    db.commit()
    return _out(db, user)


@router.put("/{user_id}", response_model=schemas.AdminUserOut)
def update_user(
    user_id: int,
    data: schemas.AdminUserUpdate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin),
):
    user = db.get(models.User, user_id)
    if not user or user.is_admin:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if data.password:
        user.password_hash = hash_password(data.password)
    if data.library_path is not None:
        user.library_path = data.library_path
    if data.is_active is not None:
        user.is_active = data.is_active
    db.commit()
    return _out(db, user)


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), _admin: models.User = Depends(require_admin)):
    user = db.get(models.User, user_id)
    if not user or user.is_admin:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    db.delete(user)
    db.commit()
    return {"status": "ok"}


def _run_user_scan(user_id: int) -> None:
    db = SessionLocal()
    try:
        user = db.get(models.User, user_id)
        if user:
            scan_user_library(db, user)
    finally:
        db.close()


@router.post("/{user_id}/scan")
def start_scan(
    user_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin),
):
    user = db.get(models.User, user_id)
    if not user or user.is_admin:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if scan_progress.is_scanning(user_id):
        raise HTTPException(status_code=409, detail="Сканирование уже выполняется")
    background_tasks.add_task(_run_user_scan, user_id)
    return {"status": "started"}


@router.get("/{user_id}/scan", response_model=schemas.ScanStatusOut)
def get_scan_status(user_id: int, db: Session = Depends(get_db), _admin: models.User = Depends(require_admin)):
    user = db.get(models.User, user_id)
    if not user or user.is_admin:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return scan_progress.get(user_id)
