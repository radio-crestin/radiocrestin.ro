"""Public comments under a story (docs/stories-api.md#comments): pages of visible ones, writing and deleting one's own.

A comment belongs to one of the app's users (AppUsers, found by the device id the app registers) and is
shown under that user's Profile. Profiles are created only by the team in the admin; with
StorySettings.comments_need_profile on (the default), only devices with a profile can comment.
Comments are plain text: tags are stripped when they are written, and the API never returns device
ids, only whether a comment is the asking device's ("mine").
"""
import re
from typing import Callable, Optional

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.html import strip_tags

from ..models import AppUsers, Profile, Story, StoryComment, StorySettings, StorySlide
from ..models.stories import MAX_COMMENT_CHARS
from .announcement_events import _text
from .announcement_feed import iso, is_public_slug
from .story_feed import PREVIEW_STATUSES, profile_payload

PAGE_SIZE = 30
DEFAULT_AUTHOR_NAME = 'Ascultător'
# Control characters, except the line break (\n) a comment may hold.
_CONTROL = re.compile(r'[\x00-\x09\x0b-\x1f\x7f]')
_BLANK_LINES = re.compile(r'\n{3,}')

AbsoluteUrl = Callable[[str], str]


class CommentRefused(Exception):
    """Why a comment wasn't stored: its text is the API's 400 error."""


class NoProfile(Exception):
    """The device has no profile, and only profiles may comment (the API's 403)."""


class CommentNotYours(Exception):
    """A device tried to delete another user's comment."""


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


def device_profile(device_id: str) -> Optional[Profile]:
    if not device_id:
        return None
    return Profile.objects.filter(app_user__anonymous_id=device_id).first()


def can_comment(profile: Optional[Profile]) -> bool:
    return profile is not None or not StorySettings.load().comments_need_profile


def serialize(comment: StoryComment, device_id: str, absolute_url: AbsoluteUrl) -> dict:
    author = profile_payload(comment.profile, absolute_url)
    return {
        'id': comment.pk,
        'author_name': author['name'] if author else DEFAULT_AUTHOR_NAME,
        'author_avatar_url': author['avatar_url'] if author else None,
        'text': comment.text,
        'created_at': iso(comment.created_at),
        'mine': bool(device_id) and comment.user.anonymous_id == device_id,
    }


def page(story: Story, absolute_url: AbsoluteUrl, *, before=None, device_id: str = '') -> dict:
    """Newest first, PAGE_SIZE at a time; `before` is the last id of the previous page.

    With the device's own state: whether it may comment, and as which profile. No comments while they are off.
    """
    profile = device_profile(device_id)
    viewer = {
        'can_comment': story.comments_enabled and can_comment(profile),
        'profile': profile_payload(profile, absolute_url),
    }
    if not story.comments_enabled:
        return {'count': 0, 'comments': [], 'next_before': None, **viewer}
    comments = StoryComment.objects.filter(story=story, is_hidden=False)
    count = comments.count()
    if isinstance(before, int) and not isinstance(before, bool):
        comments = comments.filter(pk__lt=before)
    rows = list(comments.select_related('user', 'profile').order_by('-id')[:PAGE_SIZE + 1])
    more = len(rows) > PAGE_SIZE
    rows = rows[:PAGE_SIZE]
    return {
        'count': count,
        'comments': [serialize(comment, device_id, absolute_url) for comment in rows],
        'next_before': rows[-1].pk if more else None,
        **viewer,
    }


def _slide_id(story: Story, value) -> Optional[int]:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        return None
    return value if StorySlide.objects.filter(pk=value, story=story).exists() else None


def _app_user(device_id: str) -> AppUsers:
    """The app's user for this device, created when the app never registered it (like listening sessions)."""
    user = AppUsers.objects.filter(anonymous_id=device_id).first()
    if user is None:
        try:
            with transaction.atomic():
                user = AppUsers.objects.create(anonymous_id=device_id)
        except IntegrityError:  # registered meanwhile
            user = AppUsers.objects.get(anonymous_id=device_id)
    return user


def upsert(story: Story, payload: dict, *, country: str = '', ip: Optional[str] = None) -> StoryComment:
    """Writes one comment as the device's user and profile.

    Raises CommentRefused when comments are off or the text doesn't fit, NoProfile when only profiles
    may comment and the device has none. A slide id that isn't one of the story's slides is stored as no slide.
    """
    device_id = _text(payload.get('device_id'), 512)
    if not story.comments_enabled:
        raise CommentRefused('comments are off for this story')
    text = clean_text(payload.get('text'))
    if not text:
        raise CommentRefused('text is empty')
    if len(text) > MAX_COMMENT_CHARS:
        raise CommentRefused(f'text is longer than {MAX_COMMENT_CHARS} characters')
    profile = device_profile(device_id)
    if not can_comment(profile):
        raise NoProfile()
    user = profile.app_user if profile else _app_user(device_id)
    return StoryComment.objects.create(
        story=story,
        slide_id=_slide_id(story, payload.get('slide')),
        text=text,
        user=user,
        profile=profile,
        platform=_text(payload.get('platform'), 32),
        app_version=_text(payload.get('app_version'), 64),
        locale=_text(payload.get('locale'), 64),
        country=country[:2],
        ip=ip,
    )


def delete(story: Story, comment_id: int, device_id: str) -> bool:
    """Deletes the device's own comment. False when the story has no such comment; CommentNotYours for another's."""
    comment = StoryComment.objects.filter(story=story, pk=comment_id).select_related('user').first()
    if comment is None:
        return False
    if not device_id or comment.user.anonymous_id != device_id:
        raise CommentNotYours()
    comment.delete()
    return True
