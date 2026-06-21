from threading import Lock

_lock = Lock()
_progress: dict[int, dict] = {}


def start(user_id: int, total: int) -> None:
    with _lock:
        _progress[user_id] = {"scanning": True, "processed": 0, "total": total}


def update(user_id: int, processed: int) -> None:
    with _lock:
        if user_id in _progress:
            _progress[user_id]["processed"] = processed


def finish(user_id: int) -> None:
    with _lock:
        if user_id in _progress:
            _progress[user_id]["scanning"] = False


def get(user_id: int) -> dict:
    with _lock:
        return dict(_progress.get(user_id, {"scanning": False, "processed": 0, "total": 0}))


def is_scanning(user_id: int) -> bool:
    with _lock:
        return _progress.get(user_id, {}).get("scanning", False)
