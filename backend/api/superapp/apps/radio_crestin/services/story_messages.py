"""Stores the messages listeners write under a story (docs/stories-api.md#messages)."""
from typing import Optional

from django.db.models import Q
from django.utils import timezone

from ..models import Story, StoryMessage, StorySlide
from ..models.stories import MAX_MESSAGE_CHARS
from .announcement_events import _text
from .story_feed import PREVIEW_STATUSES


class MessageRefused(Exception):
    """Why a message wasn't stored: its text is the API's 400 error."""


def _story_taking_messages(slug) -> Optional[Story]:
    if not isinstance(slug, str) or not slug:
        return None
    now = timezone.now()
    return (Story.objects.filter(slug=slug, status__in=PREVIEW_STATUSES, starts_at__lte=now, messages_enabled=True)
            .filter(Q(ends_at__isnull=True) | Q(ends_at__gt=now)).first())


def _slide_id(story: Story, value) -> Optional[int]:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        return None
    return value if StorySlide.objects.filter(pk=value, story=story).exists() else None


def upsert(payload: dict, *, country: str = '', ip: Optional[str] = None) -> StoryMessage:
    """Saves one message; raises MessageRefused when its text or its story can't take it.

    A slide id that isn't one of the story's slides is stored as no slide, like the events'.
    """
    text = payload.get('text')
    text = text.strip() if isinstance(text, str) else ''
    if not text:
        raise MessageRefused('text is empty')
    if len(text) > MAX_MESSAGE_CHARS:
        raise MessageRefused(f'text is longer than {MAX_MESSAGE_CHARS} characters')
    story = _story_taking_messages(payload.get('story'))
    if story is None:
        raise MessageRefused('this story does not take messages')
    return StoryMessage.objects.create(
        story=story,
        slide_id=_slide_id(story, payload.get('slide')),
        text=text,
        device_id=_text(payload.get('device_id'), 512),
        platform=_text(payload.get('platform'), 32),
        app_version=_text(payload.get('app_version'), 64),
        locale=_text(payload.get('locale'), 64),
        country=country[:2],
        ip=ip,
    )


def delete(message: StoryMessage):
    message.delete()
