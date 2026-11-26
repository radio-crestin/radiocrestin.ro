"""Reads an uploaded story video (length, size, sound) with ffprobe, and takes its poster frame with ffmpeg.

Both binaries are in the API image (Dockerfile: static ffmpeg/ffprobe). The admin form
calls these before saving, so a video over the limits is refused with a message.
"""
import json
import os
import shutil
import subprocess
import tempfile
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Optional

from django.core.files.base import ContentFile

PROBE_TIMEOUT_SECONDS = 30
POSTER_AT_SECONDS = 1.0


class MediaError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class VideoInfo:
    seconds: float
    width: Optional[int]
    height: Optional[int]
    has_sound: bool
    codec: str


@contextmanager
def local_path(upload):
    """A path on disk for an upload: its temporary file, or a copy of an in-memory one."""
    temporary_path = getattr(upload, 'temporary_file_path', None)
    if temporary_path:
        yield temporary_path()
        return
    handle, path = tempfile.mkstemp(suffix='.mp4')
    try:
        with os.fdopen(handle, 'wb') as out:
            upload.seek(0)
            for chunk in upload.chunks():
                out.write(chunk)
        upload.seek(0)
        yield path
    finally:
        os.unlink(path)


def _binary(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise MediaError('no_ffmpeg')
    return path


def probe(path: str) -> VideoInfo:
    """The video's length, size and whether it has sound; MediaError('unreadable') when it isn't a video."""
    try:
        result = subprocess.run(
            [_binary('ffprobe'), '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path],
            capture_output=True, timeout=PROBE_TIMEOUT_SECONDS, check=True,
        )
        data = json.loads(result.stdout or b'{}')
    except (subprocess.SubprocessError, ValueError):
        raise MediaError('unreadable')
    streams = data.get('streams') or []
    video = next((stream for stream in streams if stream.get('codec_type') == 'video'), None)
    try:
        seconds = float((data.get('format') or {}).get('duration') or (video or {}).get('duration') or 0)
    except (TypeError, ValueError):
        seconds = 0
    if video is None or seconds <= 0:
        raise MediaError('unreadable')
    width, height = video.get('width'), video.get('height')
    if _rotated(video):
        width, height = height, width
    return VideoInfo(
        seconds=round(seconds, 2), width=width, height=height,
        has_sound=any(stream.get('codec_type') == 'audio' for stream in streams),
        codec=video.get('codec_name') or '',
    )


def _rotated(video: dict) -> bool:
    """Phone videos are often stored landscape with a 90° rotation flag."""
    rotations = [video.get('tags', {}).get('rotate')]
    rotations += [side.get('rotation') for side in video.get('side_data_list') or []]
    for rotation in rotations:
        try:
            if abs(int(float(rotation))) % 180 == 90:
                return True
        except (TypeError, ValueError):
            continue
    return False


def poster_frame(path: str, seconds: float) -> Optional[ContentFile]:
    """A JPEG of the frame at one second (or the first frame of a shorter video); None when it fails."""
    at = POSTER_AT_SECONDS if seconds > POSTER_AT_SECONDS * 2 else 0
    try:
        result = subprocess.run(
            [_binary('ffmpeg'), '-v', 'error', '-ss', str(at), '-i', path, '-frames:v', '1',
             '-vf', "scale='min(1280,iw)':-2", '-q:v', '3', '-f', 'image2', '-c:v', 'mjpeg', 'pipe:1'],
            capture_output=True, timeout=PROBE_TIMEOUT_SECONDS, check=True,
        )
    except (subprocess.SubprocessError, MediaError):
        return None
    return ContentFile(result.stdout) if result.stdout else None
