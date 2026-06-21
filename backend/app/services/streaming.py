import os
import re
from fastapi import Request
from starlette.responses import StreamingResponse, Response

_CHUNK_SIZE = 1024 * 1024

_MEDIA_TYPES = {
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".opus": "audio/opus",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".wav": "audio/wav",
}


def guess_media_type(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    return _MEDIA_TYPES.get(ext, "application/octet-stream")


def range_file_response(path: str, request: Request) -> Response:
    file_size = os.path.getsize(path)
    media_type = guess_media_type(path)
    range_header = request.headers.get("range")

    if not range_header:
        def iterfile():
            with open(path, "rb") as f:
                while chunk := f.read(_CHUNK_SIZE):
                    yield chunk

        return StreamingResponse(
            iterfile(),
            media_type=media_type,
            headers={"Accept-Ranges": "bytes", "Content-Length": str(file_size)},
        )

    match = re.match(r"bytes=(\d*)-(\d*)", range_header)
    if not match:
        return Response(status_code=416)

    start_str, end_str = match.groups()
    start = int(start_str) if start_str else 0
    end = int(end_str) if end_str else file_size - 1
    end = min(end, file_size - 1)
    if start > end or start >= file_size:
        return Response(status_code=416, headers={"Content-Range": f"bytes */{file_size}"})

    length = end - start + 1

    def iter_range():
        with open(path, "rb") as f:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(_CHUNK_SIZE, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    return StreamingResponse(
        iter_range(),
        status_code=206,
        media_type=media_type,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Content-Length": str(length),
        },
    )
