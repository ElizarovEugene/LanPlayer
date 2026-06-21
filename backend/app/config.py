from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_project_root = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    database_url: str = f"sqlite:///{_project_root}/lanplayer.db"
    covers_dir: str = str(_project_root / "covers")

    cors_origins: str = "http://localhost:5175"
    jwt_secret: str = "change-me-in-production"
    jwt_expire_minutes: int = 525600
    admin_password: str = ""
    auth_cookie_name: str = "lp_token"
    auth_cookie_secure: bool = False

    scan_interval_minutes: int = 60
    history_min_played_ratio: float = 0.9

    musicbrainz_user_agent: str = "LanPlayer/0.1 (local)"
    fanart_api_key: str = ""

    model_config = SettingsConfigDict(env_file=str(_project_root / ".env"))


settings = Settings()
