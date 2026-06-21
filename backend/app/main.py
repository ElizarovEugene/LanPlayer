from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.routers import auth, library, playlists, likes, history, playback, eq, settings as settings_router, admin_users
from app import models, scheduler
from app.config import settings


def migrate_db() -> None:
    from sqlalchemy import text
    stmts = [
        "ALTER TABLE tracks ADD COLUMN genre VARCHAR(200)",
        "ALTER TABLE playlists ADD COLUMN smart_field VARCHAR(20)",
        "ALTER TABLE playlists ADD COLUMN smart_value VARCHAR(200)",
        "ALTER TABLE playback_state ADD COLUMN volume FLOAT DEFAULT 0.7",
        "ALTER TABLE users ADD COLUMN language VARCHAR(5) NOT NULL DEFAULT 'en'",
        "ALTER TABLE users ADD COLUMN active_eq_preset_id VARCHAR(30)",
        "ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0",
    ]
    with engine.connect() as conn:
        for stmt in stmts:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass


def ensure_admin_account() -> None:
    from app.database import SessionLocal
    from app.security import hash_password, verify_password

    if not settings.admin_password:
        print("[lanplayer] ADMIN_PASSWORD не задан в .env — учётка admin не создана/не обновлена")
        return
    db = SessionLocal()
    try:
        admin = db.query(models.User).filter(models.User.username == "admin").first()
        if admin is None:
            admin = models.User(
                username="admin",
                password_hash=hash_password(settings.admin_password),
                library_path="",
                is_admin=True,
            )
            db.add(admin)
            db.commit()
            print("[lanplayer] Создана учётка admin")
        elif not verify_password(settings.admin_password, admin.password_hash):
            admin.password_hash = hash_password(settings.admin_password)
            db.commit()
            print("[lanplayer] Пароль учётки admin обновлён из ADMIN_PASSWORD")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    migrate_db()
    ensure_admin_account()
    scheduler.start()
    yield
    scheduler.stop()


app = FastAPI(title="LanPlayer", lifespan=lifespan)

_cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(library.router)
app.include_router(playlists.router)
app.include_router(likes.router)
app.include_router(history.router)
app.include_router(playback.router)
app.include_router(eq.router)
app.include_router(settings_router.router)
app.include_router(admin_users.router)


@app.get("/health")
def health():
    return {"status": "ok"}
