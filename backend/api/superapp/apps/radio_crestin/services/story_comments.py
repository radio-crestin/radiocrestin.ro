"""Public comments under a story (docs/stories-api.md#comments): pages of visible ones, writing and deleting one's own.

Comments are plain text: tags are stripped when they are written, and the API never
returns device ids, only whether a comment is the asking device's ("mine").
"""
import re
from typing import Optional

from django.db.models import Q
from django.utils import timezone
from django.utils.html import strip_tags

from ..models import Story, StoryComment, StorySlide
from ..models.stories import MAX_COMMENT_AUTHOR_CHARS, MAX_COMMENT_CHARS
from .announcement_events import _text
from .announcement_feed import iso, is_public_slug
from .story_feed import PREVIEW_STATUSES

PAGE_SIZE = 30
DEFAULT_AUTHOR_NAME = 'Ascultător'
# Control characters, except the line break (\n) a comment may hold.
_CONTROL = re.compile(r'[\x00-\x09\x0b-\x1f\x7f]')
_BLANK_LINES = re.compile(r'\n{3,}')


class CommentRefused(Exception):
    """Why a comment wasn't stored: its text is the API's 400 error."""


class CommentNotYours(Exception):
    """A device tried to delete another device's comment."""


def live_story(slug: str) -> Optional[Story]:
    """The story while it is listed (active, or in Preview) and inside its time window."""
    if not is_public_slug(slug or ''):
        return None
    now = timezone.now()
    return (Story.objects.filter(slug=slug, status__in=PREVIEW_STATUSES, starts_at__lte=now)
            .filter(Q(ends_at__isnull=True) | Q(ends_at__gt=now)).first())


def clean_text(value) -> str:
    """Plain text: no HTML tags, no control characters, at most one blank line in a row."""
    if not isinstance(value, str):
        return ''
    text = _CONTROL.sub('', strip_tags(value.replace('\r\n', '\n').replace('\r', '\n')))
    return _BLANK_LINES.sub('\n\n', text).strip()


def visible(story: Story):
    return StoryComment.objects.filter(story=story, is_hidden=False)


def serialize(comment: StoryComment, device_id: str) -> dict:
    return {
        'id': comment.pk,
        'author_name': comment.author_name or DEFAULT_AUTHOR_NAME,
        'text': comment.text,
        'created_at': iso(comment.created_at),
        'mine': bool(device_id) and comment.device_id == device_id,
    }


def page(story: Story, *, before=None, device_id: str = '') -> dict:
    """Newest first, PAGE_SIZE at a time; `before` is the last id of the previous page. Empty while comments are off."""
    if not story.comments_enabled:
        return {'count': 0, 'comments': [], 'next_before': None}
    comments = visible(story)
    count = comments.count()
    if isinstance(before, int) and not isinstance(before, bool):
        comments = comments.filter(pk__lt=before)
    rows = list(comments.order_by('-id')[:PAGE_SIZE + 1])
    more = len(rows) > PAGE_SIZE
    rows = rows[:PAGE_SIZE]
    return {
        'count': count,
        'comments': [serialize(comment, device_id) for comment in rows],
        'next_before': rows[-1].pk if more else None,
    }


def _slide_id(story: Story, value) -> Optional[int]:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        return None
    return value if StorySlide.objects.filter(pk=value, story=story).exists() else None


def upsert(story: Story, payload: dict, *, country: str = '', ip: Optional[str] = None) -> StoryComment:
    """Writes one comment; raises CommentRefused when comments are off or its text or name don't fit.

    A slide id that isn't one of the story's slides is stored as no slide, like the events'.
    """
    if not story.comments_enabled:
        raise CommentRefused('comments are off for this story')
    text = clean_text(payload.get('text'))
    if not text:
        raise CommentRefused('text is empty')
    if len(text) > MAX_COMMENT_CHARS:
        raise CommentRefused(f'text is longer than {MAX_COMMENT_CHARS} characters')
    author_name = ' '.join(clean_text(payload.get('author_name')).split())
    if len(author_name) > MAX_COMMENT_AUTHOR_CHARS:
        raise CommentRefused(f'author_name is longer than {MAX_COMMENT_AUTHOR_CHARS} characters')
    return StoryComment.objects.create(
        story=story,
        slide_id=_slide_id(story, payload.get('slide')),
        text=text,
        author_name=author_name,
        device_id=_text(payload.get('device_id'), 512),
        platform=_text(payload.get('platform'), 32),
        app_version=_text(payload.get('app_version'), 64),
        locale=_text(payload.get('locale'), 64),
        country=country[:2],
        ip=ip,
    )


def delete(story: Story, comment_id: int, device_id: str) -> bool:
    """Deletes the device's own comment. False when the story has no such comment; CommentNotYours for another's."""
    comment = StoryComment.objects.filter(story=story, pk=comment_id).first()
    if comment is None:
        return False
    if not device_id or comment.device_id != device_id:
        raise CommentNotYours()
    comment.delete()
    return True
