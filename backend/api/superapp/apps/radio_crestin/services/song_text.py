"""Rejects text that is not a song title or artist.

The streaming pods parse ICY titles out of ffmpeg's log output; a decoder
message that continued a StreamTitle line ("ChannelElement 3.1 missing") was
stored as alt-fm's song on 2026-09-02. The pods now filter these too
(live_streaming/scripts/song_titles.py); this is the server-side guard.
"""

import re
from typing import Optional

from superapp.apps.radio_crestin_scraping.utils.text_repair import undo_double_utf8

_FFMPEG_MESSAGES = (
    # "[aac @ 0x55d5c8a3e2c0]": a context and its address, which is 0x-hex
    # or 16 bare hex digits (Windows), so "[Live @ 2024] Isus" is a title.
    re.compile(r"^\[[\w:.-]+ @ (0x[0-9a-fA-F]+|[0-9a-fA-F]{16})\]"),
    re.compile(r"\bChannelElement \d+\.\d+ missing\b", re.IGNORECASE),
    re.compile(r"\bchannel element \d+\.\d+ (is not allocated|duplicate)\b",
               re.IGNORECASE),
    re.compile(r"\b(Error while decoding|Invalid data found when processing "
               r"input)\b", re.IGNORECASE),
)
_PLACEHOLDERS = {"", "-", "--", "n/a", "na", "null", "none", "undefined",
                 "unknown", "unknown artist", "live", "my station name"}
_WEB_ADDRESS = re.compile(r"^(https?://|www\.)\S+$", re.IGNORECASE)
_AUDIO_FILE_EXTENSION = re.compile(r"\.(mp3|m4a|aac|wav|flac|ogg|opus|wma)$", re.IGNORECASE)


_EDGE_SEPARATORS = re.compile(r"^[\s\-–—]+|[\s\-–—]+$")


def is_garbage_song_text(value: Optional[str]) -> bool:
    """True for ffmpeg log messages and empty placeholders."""
    text = " ".join(str(value or "").split())
    return (text.casefold() in _PLACEHOLDERS or bool(_WEB_ADDRESS.match(text))
            or any(p.search(text) for p in _FFMPEG_MESSAGES))


def clean_song_text(value: Optional[str]) -> Optional[str]:
    """`value` repaired and tidied, or None when it is not song text.

    Tidied: double-encoded UTF-8 undone, BOM dropped, underscores as spaces,
    whitespace collapsed, no file extension and no dangling " -".
    """
    if value is None:
        return None
    text = undo_double_utf8(str(value)).replace("\ufeff", "").replace("_", " ")
    text = _EDGE_SEPARATORS.sub("", _AUDIO_FILE_EXTENSION.sub("", " ".join(text.split())))
    return None if is_garbage_song_text(text) else text
