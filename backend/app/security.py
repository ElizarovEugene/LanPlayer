import hashlib
import secrets
from jose import JWTError, jwt
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app import models

optional_bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(32)
    h = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 260000)
    return f"pbkdf2$sha256${salt}${h.hex()}"


def verify_password(plain: str, hashed: str) -> bool:
    parts = hashed.split('$')
    if len(parts) != 4 or parts[0] != 'pbkdf2':
        return False
    _, algo, salt, stored = parts
    h = hashlib.pbkdf2_hmac(algo, plain.encode(), salt.encode(), 260000)
    return secrets.compare_digest(h.hex(), stored)


def create_token(user_id: int, username: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode(
        {"sub": str(user_id), "username": username, "exp": expire},
        settings.jwt_secret,
        algorithm="HS256",
    )


def _user_from_jwt(token: str, db: Session) -> models.User | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None
    user = db.get(models.User, user_id)
    if not user or not user.is_active:
        return None
    return user


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Недействительный токен")
    raw_token = credentials.credentials if credentials else request.cookies.get(settings.auth_cookie_name)
    if not raw_token:
        raise exc
    user = _user_from_jwt(raw_token, db)
    if user is None:
        raise exc
    return user


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуются права администратора")
    return user


def get_current_user_for_media(
    request: Request,
    token: str | None = None,
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    """Как get_current_user, но также принимает токен в query-параметре —
    нужно для <audio>/<img>, которые не умеют слать заголовок Authorization
    (хотя с httpOnly-cookie браузер шлёт её автоматически и для них)."""
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Недействительный токен")
    raw_token = credentials.credentials if credentials else (token or request.cookies.get(settings.auth_cookie_name))
    if not raw_token:
        raise exc
    user = _user_from_jwt(raw_token, db)
    if user is None:
        raise exc
    return user
