from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from app.database import SessionLocal
from app.config import settings
from app.services.scanner import scan_all_users
from app.services.coverart import fetch_missing_covers_all_users
from app.services.fanart import fetch_missing_artist_photos_all_users

scheduler = BackgroundScheduler()


def _scan_job():
    db = SessionLocal()
    try:
        scan_all_users(db)
        fetch_missing_covers_all_users(db)
        fetch_missing_artist_photos_all_users(db)
    finally:
        db.close()


def start():
    scheduler.add_job(
        _scan_job, "interval", minutes=settings.scan_interval_minutes,
        id="library_scan", replace_existing=True, next_run_time=datetime.now(),
    )
    scheduler.start()


def stop():
    scheduler.shutdown()
