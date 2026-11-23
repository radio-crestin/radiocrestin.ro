"""Reads an AzuraCast station's now-playing API: https://<host>/api/nowplaying/<station shortcode>."""
import json
from typing import Any, Optional
from urllib.parse import urlsplit

from .base import BaseScraper
from ..utils.data_types import StationNowPlayingData
from ..utils.formatters import DataFormatter


def song_cover_url(art_url: Optional[str]) -> Optional[str]:
    """The song's own cover, or None for AzuraCast's fallback.

    A song with a cover has art at `.../art/<id>-<timestamp>.<ext>`. One without
    gets `.../art/<id>`, which redirects to the station's default album art,
    usually its logo, so it is not stored as the song's cover.
    """
    if not art_url:
        return None
    file_name = urlsplit(art_url).path.rsplit('/', 1)[-1]
    return art_url if '.' in file_name else None


class AzuraCastScraper(BaseScraper):

    def get_scraper_type(self) -> str:
        return "azuracast"

    def extract_data(self, response_data: Any, config=None) -> StationNowPlayingData:
        if isinstance(response_data, (str, bytes)):
            try:
                response_data = json.loads(response_data)
            except (json.JSONDecodeError, ValueError):
                return StationNowPlayingData(current_song=None, listeners=None)
        if not isinstance(response_data, dict):
            return StationNowPlayingData(current_song=None, listeners=None)

        song = (response_data.get("now_playing") or {}).get("song") or {}
        artist, title = song.get("artist"), song.get("title")
        if not (artist or title):
            title, artist = DataFormatter.parse_title_artist(song.get("text", ""), config)

        return StationNowPlayingData(
            current_song=self._create_song_data(
                name=title,
                artist=artist,
                thumbnail_url=song_cover_url(song.get("art")),
                raw_title=song.get("text"),
            ),
            listeners=self._listeners(response_data),
            raw_data=[response_data],
        )

    @staticmethod
    def _listeners(response_data: dict) -> Optional[int]:
        current = (response_data.get("listeners") or {}).get("current")
        try:
            return int(current)
        except (TypeError, ValueError):
            return None
