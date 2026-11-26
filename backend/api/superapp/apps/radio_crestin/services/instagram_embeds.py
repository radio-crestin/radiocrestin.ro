"""Instagram posts and reels shown as story slides.

A slide stores the post's canonical URL. When the backend has a Meta app token
(env INSTAGRAM_OEMBED_TOKEN: "<app id>|<client token>", or an app access token),
saving the slide also fetches Instagram's oEmbed (thumbnail, author, caption) into
its embed_details, so the API never waits on Instagram. Without the token only the
URL is stored, and the clients show Instagram's embed page or a link
(backend/docs/stories-api.md#instagram).
"""
import logging
import os
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Optional
from urllib.parse import urlsplit

from django.utils import timezone

logger = logging.getLogger(__name__)

TOKEN_ENV = 'INSTAGRAM_OEMBED_TOKEN'
OEMBED_URL = 'https://graph.facebook.com/v21.0/instagram_oembed'
OEMBED_TIMEOUT_SECONDS = 5
HOSTS = {'instagram.com', 'www.instagram.com', 'm.instagram.com', 'instagr.am', 'www.instagr.am'}
SHORTCODE = re.compile(r'^[A-Za-z0-9_-]{5,64}$')
# Path segment -> kind; IGTV (tv) videos are reels now.
PATH_KINDS = {'p': 'post', 'reel': 'reel', 'reels': 'reel', 'tv': 'reel'}
CANONICAL_SEGMENT = {'post': 'p', 'reel': 'reel'}
MAX_CAPTION_LENGTH = 500
MAX_TEXT_LENGTH = 200


@dataclass(frozen=True)
class InstagramPost:
    kind: str  # post | reel
    shortcode: str

    @property
    def url(self) -> str:
        return f'https://www.instagram.com/{CANONICAL_SEGMENT[self.kind]}/{self.shortcode}/'

    @property
    def embed_url(self) -> str:
        return f'{self.url}embed/'


def parse(url: str) -> Optional[InstagramPost]:
    """The post or reel an Instagram link stands for; None for profiles, stories and anything else."""
    try:
        parts = urlsplit((url or '').strip())
    except ValueError:
        return None
    if parts.scheme not in ('http', 'https') or (parts.hostname or '').lower() not in HOSTS:
        return None
    segments = [segment for segment in parts.path.split('/') if segment]
    if len(segments) == 3:  # instagram.com/<user>/p/<code>/ and /<user>/reel/<code>/
        segments = segments[1:]
    if len(segments) != 2 or segments[0] not in PATH_KINDS or not SHORTCODE.match(segments[1]):
        return None
    return InstagramPost(PATH_KINDS[segments[0]], segments[1])


def token() -> str:
    return os.environ.get(TOKEN_ENV, '').strip()


def is_configured() -> bool:
    return bool(token())


def _text(value, max_length: int) -> Optional[str]:
    if not isinstance(value, str):
        return None
    text = ' '.join(''.join(char if char.isprintable() else ' ' for char in value).split())
    return text[:max_length] or None


def _https(value) -> Optional[str]:
    return value if isinstance(value, str) and value.startswith('https://') and len(value) <= 2000 else None


def _dimension(value) -> Optional[int]:
    return value if isinstance(value, int) and not isinstance(value, bool) and 0 < value <= 10_000 else None


class _CaptionParser(HTMLParser):
    """The caption in oEmbed's blockquote: the text of its first <p> that isn't the "shared by" credit."""

    def __init__(self):
        super().__init__()
        self.paragraphs, self._depth, self._current = [], 0, None

    def handle_starttag(self, tag, attrs):
        if tag == 'p':
            self._current = []
        elif tag == 'a' and self._current is not None:
            self._depth += 1

    def handle_endtag(self, tag):
        if tag == 'p' and self._current is not None:
            self.paragraphs.append(''.join(self._current))
            self._current = None
        elif tag == 'a' and self._depth:
            self._depth -= 1

    def handle_data(self, data):
        if self._current is not None:
            self._current.append(data)


def caption_from_html(html) -> Optional[str]:
    if not isinstance(html, str):
        return None
    parser = _CaptionParser()
    try:
        parser.feed(html)
    except Exception:  # noqa: BLE001 - a broken embed just has no caption
        return None
    for paragraph in parser.paragraphs:
        text = _text(paragraph, MAX_CAPTION_LENGTH)
        if text and not text.lower().startswith(('a post shared by', 'o postare distribuită')):
            return text
    return None


def details_from_oembed(data: dict) -> dict:
    """The stored details from an oEmbed answer: only clean values, never its HTML."""
    if not isinstance(data, dict):
        return {}
    media_type = data.get('media_type') if data.get('media_type') in ('image', 'video') else None
    media_url = _https(data.get('media_url')) if media_type else None
    details = {
        'author_name': _text(data.get('author_name'), MAX_TEXT_LENGTH),
        'author_url': _https(data.get('author_url')),
        'caption': _text(data.get('title'), MAX_CAPTION_LENGTH) or caption_from_html(data.get('html')),
        'thumbnail_url': _https(data.get('thumbnail_url')),
        'thumbnail_width': _dimension(data.get('thumbnail_width')),
        'thumbnail_height': _dimension(data.get('thumbnail_height')),
        'media_url': media_url,
        'media_type': media_type if media_url else None,
    }
    return {key: value for key, value in details.items() if value is not None}


def fetch_details(post: InstagramPost) -> dict:
    """Instagram's oEmbed for the post, cleaned, with when it was fetched; {} without a token or on failure."""
    access_token = token()
    if not access_token:
        return {}
    import requests

    try:
        response = requests.get(OEMBED_URL, params={
            'url': post.url, 'access_token': access_token, 'omitscript': 'true',
        }, timeout=OEMBED_TIMEOUT_SECONDS)
        response.raise_for_status()
        data = response.json()
    except (requests.RequestException, ValueError) as error:
        # The URL holds the token: log only the error's type.
        logger.warning('Instagram oEmbed failed for %s: %s', post.shortcode, type(error).__name__)
        return {}
    details = details_from_oembed(data)
    if details:
        details['fetched_at'] = timezone.now().replace(microsecond=0).isoformat()
    return details


def api_item(post: InstagramPost, details: Optional[dict] = None) -> dict:
    """The slide's `instagram` object (docs/stories-api.md#instagram)."""
    details = details or {}
    return {
        'url': post.url,
        'kind': post.kind,
        'thumbnail_url': details.get('thumbnail_url'),
        'author_name': details.get('author_name'),
        'caption': details.get('caption'),
        'media_url': details.get('media_url'),
        'media_type': details.get('media_type'),
        'shortcode': post.shortcode,
        'embed_url': post.embed_url,
        'author_url': details.get('author_url'),
        **{key: details[key] for key in ('thumbnail_width', 'thumbnail_height') if details.get(key)},
    }
