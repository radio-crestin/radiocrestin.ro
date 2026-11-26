"""The stories clients get (backend/docs/stories-api.md): one list for everyone, filtered on the device.

Payloads are cached, and dropped by signals/stories.py whenever something they
serve changes; each request then sets the current like and comment counts and
renders the body with its ETag, so they are never older than the CDN's max-age.
"""
import secrets
from datetime import datetime, timedelta
from typing import Callable, Optional
from urllib.parse import urlencode

from django.core.cache import cache
from django.db.models import Count, Prefetch, Q
from django.utils import timezone

from ..models import (
    CtaStyle, CtaTarget, InAppRoute, SlideType, Story, StoryComment, StoryLike, StorySettings, StorySlide, StoryStatus,
)
from . import instagram_embeds, youtube_embeds
from .announcement_feed import (
    STATION_SLUG_RE, RenderedResponse, filters_payload, is_public_slug, iso, render,
)

UPCOMING_WINDOW = timedelta(days=7)
CACHE_SECONDS = 300
GENERATION_KEY = 'stories:generation'
PUBLIC_STATUSES = (StoryStatus.ACTIVE,)
PREVIEW_STATUSES = (StoryStatus.ACTIVE, StoryStatus.PREVIEW)
SHARE_URL = 'https://www.radiocrestin.ro/poveste/{slug}/'
YOUTUBE_SEARCH_URL = 'https://www.youtube.com/results?'
VIDEO_MIME_TYPE = 'video/mp4'

AbsoluteUrl = Callable[[str], str]


def share_url(slug: str) -> str:
    return SHARE_URL.format(slug=slug)


def _file_url(file_field, absolute_url: AbsoluteUrl) -> Optional[str]:
    if not file_field:
        return None
    url = absolute_url(file_field.url)
    # The API makes local paths absolute; the admin preview shows them as they are.
    return url if url.lower().startswith(('https://', 'http://', '/')) else None


def _station_slug(station) -> Optional[str]:
    return station.slug if station and STATION_SLUG_RE.match(station.slug or '') else None


def _public_slug(obj) -> Optional[str]:
    return obj.slug if obj is not None and is_public_slug(obj.slug) else None


# ---------------------------------------------------------------- slides

def _media(slide: StorySlide, absolute_url: AbsoluteUrl) -> Optional[dict]:
    """The keys of the slide's type; None when its media is missing (the slide is then left out)."""
    details = slide.embed_details or {}
    if slide.type == SlideType.IMAGE:
        url = _file_url(slide.image, absolute_url)
        return url and {'media_url': url, 'poster_url': None, 'has_sound': False, **_size(slide)}
    if slide.type == SlideType.VIDEO:
        url = _file_url(slide.video, absolute_url)
        return url and {
            'media_url': url, 'poster_url': _file_url(slide.poster, absolute_url), 'has_sound': slide.has_sound,
            **_size(slide),
            **({'size_bytes': slide.media_size_bytes} if slide.media_size_bytes else {}),
            'mime_type': VIDEO_MIME_TYPE,
        }
    if slide.type == SlideType.YOUTUBE:
        embed = youtube_embeds.parse(slide.youtube_url)
        if embed is None:
            return None
        item = youtube_embeds.api_item(embed, details)
        return {'media_url': None, 'poster_url': item.get('thumbnail'), 'has_sound': True,
                'youtube_url': embed.url, 'youtube': item}
    if slide.type == SlideType.INSTAGRAM:
        post = instagram_embeds.parse(slide.instagram_url)
        if post is None:
            return None
        item = instagram_embeds.api_item(post, details)
        return {'media_url': None, 'poster_url': item['thumbnail_url'],
                'has_sound': item['media_type'] == 'video', 'instagram': item}
    return None


def _size(slide: StorySlide) -> dict:
    if slide.media_width and slide.media_height:
        return {'width': slide.media_width, 'height': slide.media_height}
    return {}


def _in_app_target(slide: StorySlide) -> Optional[dict]:
    route = slide.cta_route
    target = {'type': CtaTarget.IN_APP, 'route': route}
    if route == InAppRoute.STATION:
        target['slug'] = _station_slug(slide.cta_station)
    elif route == InAppRoute.SONG:
        song = slide.cta_song
        if song is None:
            return None
        artist = song.artist.name if song.artist_id and song.artist else None
        target.update({
            'slug': str(song.pk),
            'song': {'id': song.pk, 'name': song.name, 'artist': artist},
            'fallback_url': slide.cta_fallback_url or YOUTUBE_SEARCH_URL + urlencode(
                {'search_query': ' '.join(part for part in (artist, song.name) if part)}),
        })
    elif route == InAppRoute.ANNOUNCEMENT:
        target['slug'] = _public_slug(slide.cta_announcement)
    elif route == InAppRoute.FORM:
        target['slug'] = _public_slug(slide.cta_form)
    elif route == InAppRoute.SHARE and slide.cta_share_text:
        target['share_text'] = slide.cta_share_text
    if route in (InAppRoute.STATION, InAppRoute.ANNOUNCEMENT, InAppRoute.FORM) and not target['slug']:
        return None  # what it opened was deleted
    if slide.cta_fallback_url and 'fallback_url' not in target:
        target['fallback_url'] = slide.cta_fallback_url
    return target


def cta_target(slide: StorySlide) -> Optional[dict]:
    if slide.cta_target == CtaTarget.URL:
        return {'type': CtaTarget.URL, 'url': slide.cta_url, 'open_in': slide.cta_open_in} if slide.cta_url else None
    if slide.cta_target == CtaTarget.APP_LINK:
        if not slide.cta_app_url:
            return None
        target = {'type': CtaTarget.APP_LINK, 'app': slide.cta_app, 'app_url': slide.cta_app_url,
                  'fallback_url': slide.cta_fallback_url or None}
        if slide.cta_android_intent_uri:
            target['android_intent_uri'] = slide.cta_android_intent_uri
        return target
    if slide.cta_target == CtaTarget.IN_APP:
        return _in_app_target(slide)
    if slide.cta_target == CtaTarget.STORY:
        slug = _public_slug(slide.cta_story)
        return {'type': CtaTarget.STORY, 'story_slug': slug} if slug else None
    return None


def cta_payload(slide: StorySlide) -> Optional[dict]:
    if slide.cta_style == CtaStyle.NONE or not slide.cta_label.strip():
        return None
    target = cta_target(slide)
    if not target:
        return None
    return {
        'style': slide.cta_style, 'label': slide.cta_label.strip(), 'target': target,
        'color': _color(slide.cta_color), 'text_color': _color(slide.cta_text_color),
    }


def _color(value: str) -> Optional[str]:
    return value.upper() if value else None


def serialize_slide(slide: StorySlide, absolute_url: AbsoluteUrl = lambda url: url) -> Optional[dict]:
    media = _media(slide, absolute_url)
    if not media:
        return None
    return {
        'id': slide.pk,
        'type': slide.type,
        'media_url': media.pop('media_url'),
        'poster_url': media.pop('poster_url'),
        'duration_seconds': slide.shown_seconds,
        'orientation': slide.orientation,
        'has_sound': media.pop('has_sound'),
        'youtube_url': media.pop('youtube_url', None),
        'instagram': media.pop('instagram', None),
        **media,
        'caption': slide.caption.strip() or None,
        'cta': cta_payload(slide),
    }


# ---------------------------------------------------------------- stories

def display_payload(story: Story) -> dict:
    return {
        'auto_open': story.auto_open,
        'every_days': story.every_days,
        'every_actions': story.every_actions,
        'max_shows': story.max_shows,
    }


def comments_payload(story: Story, count: int = 0) -> dict:
    """`count` is set per request by _with_fresh_counts: comments come and go without dropping the cache."""
    return {
        'enabled': story.comments_enabled,
        'placeholder': story.comments_placeholder.strip() or None,
        'count': count if story.comments_enabled else 0,
    }


def author_payload(story: Story, absolute_url: AbsoluteUrl) -> Optional[dict]:
    name = story.author_name.strip()
    if not name:
        return None
    return {'name': name, 'avatar_url': _file_url(story.author_avatar, absolute_url)}


def _cover_url(story: Story, slides: list, absolute_url: AbsoluteUrl) -> Optional[str]:
    cover = _file_url(story.cover_image, absolute_url)
    if cover:
        return cover
    first = slides[0]
    return first['media_url'] if first['type'] == SlideType.IMAGE else first['poster_url']


def serialize(story: Story, absolute_url: AbsoluteUrl = lambda url: url) -> Optional[dict]:
    """One story as the API sends it; None when none of its slides can be shown."""
    slides = [item for item in (serialize_slide(slide, absolute_url) for slide in story.slides.all()) if item]
    if not slides:
        return None
    return {
        'id': story.pk,
        'slug': story.slug,
        'title': story.title,
        'position': story.position,
        'cover_url': _cover_url(story, slides, absolute_url),
        'share_url': share_url(story.slug),
        'starts_at': iso(story.starts_at),
        'ends_at': iso(story.ends_at),
        'updated_at': iso(_updated_at(story)),
        'like_count': story.like_count,
        'filters': filters_payload(story),
        'display': display_payload(story),
        'comments': comments_payload(story),
        'author': author_payload(story, absolute_url),
        'slides': slides,
    }


def _updated_at(story: Story) -> datetime:
    return max([story.updated_at, *(slide.updated_at for slide in story.slides.all())])


def settings_payload(settings: StorySettings) -> dict:
    return {'auto_open_gap_actions': settings.auto_open_gap_actions}


# ---------------------------------------------------------------- queries

def _with_slides(queryset):
    slides = StorySlide.objects.select_related(
        'cta_station', 'cta_song__artist', 'cta_announcement', 'cta_form', 'cta_story',
    ).order_by('position', 'id')
    return queryset.prefetch_related(Prefetch('slides', queryset=slides)).order_by('position', 'id')


def listed(statuses=PUBLIC_STATUSES, now: Optional[datetime] = None):
    """Not ended, and started or starting within UPCOMING_WINDOW (clients switch them on at starts_at)."""
    now = now or timezone.now()
    return _with_slides(
        Story.objects.filter(status__in=statuses, starts_at__lte=now + UPCOMING_WINDOW)
        .filter(Q(ends_at__isnull=True) | Q(ends_at__gt=now))
    )


def live(slug: str, statuses=PUBLIC_STATUSES, now: Optional[datetime] = None) -> Optional[Story]:
    now = now or timezone.now()
    return _with_slides(
        Story.objects.filter(slug=slug, status__in=statuses, starts_at__lte=now)
        .filter(Q(ends_at__isnull=True) | Q(ends_at__gt=now))
    ).first()


def list_payload(absolute_url: AbsoluteUrl, statuses=PUBLIC_STATUSES) -> dict:
    stories = (serialize(story, absolute_url) for story in listed(statuses) if is_public_slug(story.slug))
    return {
        'settings': settings_payload(StorySettings.load()),
        'stories': _with_fresh_counts([story for story in stories if story]),
    }


def detail_payload(slug: str, absolute_url: AbsoluteUrl, statuses=PUBLIC_STATUSES) -> Optional[dict]:
    if not is_public_slug(slug):
        return None
    story = live(slug, statuses)
    payload = serialize(story, absolute_url) if story else None
    return _with_fresh_counts([payload])[0] if payload else None


def liked_payload(device_id: str) -> dict:
    """The listed stories this device liked, in story order."""
    device_id = (device_id or '').strip()[:512]
    if not device_id:
        return {'liked': []}
    liked_ids = StoryLike.objects.filter(device_id=device_id).values('story_id')
    slugs = listed().filter(pk__in=liked_ids).values_list('slug', flat=True)
    return {'liked': list(slugs)}


# ---------------------------------------------------------------- caching

def _generation() -> str:
    return cache.get_or_set(GENERATION_KEY, lambda: secrets.token_hex(8), None)


def invalidate_cache():
    """Every cached body is keyed by the generation, so a new one drops them all at once."""
    cache.set(GENERATION_KEY, secrets.token_hex(8), None)


def _cached(name: str, build: Callable[[], Optional[dict]]) -> Optional[dict]:
    """The payload, built once per generation and CACHE_SECONDS; None when there is nothing to serve."""
    key = f'stories:{_generation()}:{name}'
    entry = cache.get(key)
    if entry is None:
        payload = build()
        entry = {'payload': payload} if payload else {'missing': True}
        cache.set(key, entry, CACHE_SECONDS)
    return None if entry.get('missing') else entry['payload']


def _with_fresh_counts(stories: list) -> list:
    """like_count and comments.count as they are now.

    Likes change like_count with update(), and comments are written all the time: neither drops the
    cached payloads, so each request reads them (two indexed queries for the whole list).
    """
    ids = [story['id'] for story in stories]
    likes = dict(Story.objects.filter(pk__in=ids).values_list('id', 'like_count'))
    comments = dict(
        StoryComment.objects.filter(story_id__in=ids, is_hidden=False).order_by()
        .values('story_id').annotate(count=Count('id')).values_list('story_id', 'count')
    )
    return [{
        **story,
        'like_count': likes.get(story['id'], story['like_count']),
        'comments': {**story['comments'],
                     'count': comments.get(story['id'], 0) if story['comments']['enabled'] else 0},
    } for story in stories]


def public_list(absolute_url: AbsoluteUrl) -> RenderedResponse:
    payload = _cached('list', lambda: list_payload(absolute_url))
    return render({**payload, 'stories': _with_fresh_counts(payload['stories'])})


def public_detail(slug: str, absolute_url: AbsoluteUrl) -> Optional[RenderedResponse]:
    payload = _cached(f'item:{slug}', lambda: detail_payload(slug, absolute_url))
    return render(_with_fresh_counts([payload])[0]) if payload else None
