"""Stores the story events devices report, keeps one like per device, and bumps the totals.

Same rules as the announcements' events (services/announcement_events.py): the
endpoint is public and device ids are unsigned, so repeats from one device are
dropped through short-lived cache keys before they reach the counters, and a like
is a row per story and device, so liking twice counts once.
"""
import hashlib
from collections import Counter
from typing import Optional

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from ..models import Story, StoryCtaTarget, StoryEvent, StoryEventType, StoryLike, StorySlide
from ..models.story_events import SLIDE_COUNTER_BY_EVENT_TYPE, STORY_COUNTER_BY_EVENT_TYPE
from .announcement_events import (
    MAX_ANNOUNCEMENTS_PER_REQUEST, MAX_EVENTS_PER_REQUEST, _dedupe_cache, _occurred_at, _recent_enough, _text,
)

MAX_STORIES_PER_REQUEST = MAX_ANNOUNCEMENTS_PER_REQUEST
LIKE_TYPES = (StoryEventType.LIKE, StoryEventType.UNLIKE)
# Event type -> seconds during which a repeat from the same device (same story and slide) is dropped.
DEDUPE_SECONDS = {
    StoryEventType.VIEW: 30 * 60,
    StoryEventType.AUTO_OPEN: 30 * 60,
    StoryEventType.SLIDE_VIEW: 60,
    StoryEventType.COMPLETE: 60,
    StoryEventType.CTA_CLICK: 60,
    StoryEventType.SHARE: 60,
}
EVENT_TYPES = set(DEDUPE_SECONDS) | set(LIKE_TYPES)


def _first_in_window(story_id: int, slide_id: Optional[int], device_id: str, event_type: str) -> bool:
    device_hash = hashlib.sha256(device_id.encode('utf-8')).hexdigest()[:32]
    key = f'stories:event:{event_type}:{story_id}:{slide_id or 0}:{device_hash}'
    return _dedupe_cache().add(key, 1, DEDUPE_SECONDS[event_type])


def _slide_id(value) -> Optional[int]:
    return value if isinstance(value, int) and not isinstance(value, bool) and value > 0 else None


def _for_first_stories(events):
    kept = list(dict.fromkeys(event['story'] for event in events))[:MAX_STORIES_PER_REQUEST]
    return [event for event in events if event['story'] in kept]


def ingest(payload: dict, *, country: str = '', ip: Optional[str] = None) -> dict:
    """Saves the valid events of one request.

    Returns {'accepted', 'like_counts', 'liked'} for the stories the request names
    (docs/stories-api.md#events). Likes need a device id; the other events are
    dropped as repeats per device, story and slide (DEDUPE_SECONDS).
    """
    raw_events = payload.get('events')
    if not isinstance(raw_events, list):
        return {'accepted': 0, 'like_counts': {}, 'liked': []}
    candidates = _for_first_stories([
        event for event in raw_events[:MAX_EVENTS_PER_REQUEST]
        if isinstance(event, dict) and event.get('type') in EVENT_TYPES and isinstance(event.get('story'), str)
    ])
    ids_by_slug = dict(Story.objects.filter(slug__in={event['story'] for event in candidates})
                       .values_list('slug', 'id'))
    slide_ids = {slide_id for event in candidates if (slide_id := _slide_id(event.get('slide')))}
    story_by_slide = dict(StorySlide.objects.filter(pk__in=slide_ids, story_id__in=ids_by_slug.values())
                          .values_list('id', 'story_id'))

    common = {
        'device_id': _text(payload.get('device_id'), 512),
        'platform': _text(payload.get('platform'), 32),
        'app_version': _text(payload.get('app_version'), 64),
        'locale': _text(payload.get('locale'), 64),
        'country': country,
        'ip': ip,
    }
    now = timezone.now()
    events, likes = [], []
    for event in candidates:
        story_id = ids_by_slug.get(event['story'])
        occurred_at = _occurred_at(event.get('at'))
        if story_id is None or not _recent_enough(occurred_at, now):
            continue
        slide_id = _slide_id(event.get('slide'))
        slide_id = slide_id if story_by_slide.get(slide_id) == story_id else None
        if event['type'] == StoryEventType.SLIDE_VIEW and slide_id is None:
            continue
        record = StoryEvent(
            story_id=story_id, slide_id=slide_id, type=event['type'], occurred_at=occurred_at,
            target=event.get('target') if event.get('target') in StoryCtaTarget.values else '',
            **common,
        )
        if event['type'] in LIKE_TYPES:
            if common['device_id']:
                likes.append(record)
        elif _first_in_window(story_id, slide_id, common['device_id'], event['type']):
            events.append(record)

    with transaction.atomic():
        saved = StoryEvent.objects.bulk_create(events) if events else []
        saved += [like for like in likes if _apply_like(like)]
        if saved:
            StoryEvent.objects.bulk_create([like for like in saved if like.pk is None])
            _bump_counters(saved)
    story_ids = set(ids_by_slug.values())
    return {'accepted': len(saved), **like_state(story_ids, common['device_id'])}


def _apply_like(event: StoryEvent) -> bool:
    """Adds or removes the device's like; True when it changed something (the event is then stored)."""
    if event.type == StoryEventType.LIKE:
        try:
            with transaction.atomic():
                StoryLike.objects.create(story_id=event.story_id, device_id=event.device_id, platform=event.platform)
        except IntegrityError:
            return False  # already liked
        Story.objects.filter(pk=event.story_id).update(like_count=F('like_count') + 1)
        return True
    deleted, _ = StoryLike.objects.filter(story_id=event.story_id, device_id=event.device_id).delete()
    if deleted:
        Story.objects.filter(pk=event.story_id, like_count__gt=0).update(like_count=F('like_count') - 1)
    return bool(deleted)


def like_state(story_ids, device_id: str) -> dict:
    stories = Story.objects.filter(pk__in=story_ids).values_list('id', 'slug', 'like_count')
    liked_ids = set(StoryLike.objects.filter(story_id__in=story_ids, device_id=device_id)
                    .values_list('story_id', flat=True)) if device_id else set()
    return {
        'like_counts': {slug: count for _, slug, count in stories},
        'liked': sorted(slug for story_id, slug, _ in stories if story_id in liked_ids),
    }


def _bump_counters(events):
    story_counts = Counter((event.story_id, event.type) for event in events
                           if event.type in STORY_COUNTER_BY_EVENT_TYPE)
    increments = {}
    for (story_id, event_type), count in story_counts.items():
        field = STORY_COUNTER_BY_EVENT_TYPE[event_type]
        increments.setdefault(story_id, {})[field] = F(field) + count
    for story_id, fields in sorted(increments.items()):
        Story.objects.filter(pk=story_id).update(**fields)

    slide_counts = Counter((event.slide_id, event.type) for event in events
                           if event.slide_id and event.type in SLIDE_COUNTER_BY_EVENT_TYPE)
    slide_increments = {}
    for (slide_id, event_type), count in slide_counts.items():
        field = SLIDE_COUNTER_BY_EVENT_TYPE[event_type]
        slide_increments.setdefault(slide_id, {})[field] = F(field) + count
    for slide_id, fields in sorted(slide_increments.items()):
        StorySlide.objects.filter(pk=slide_id).update(**fields)
