"""The stories API (backend/docs/stories-api.md): the list, one story, a device's likes, the events, comments."""
import json
from typing import Optional

from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt

from ..services import announcement_feed, story_comments, story_events, story_feed
from ..utils.client_request import client_country, client_ip, safe_ip
from .announcements_api import (
    EVENTS_RATE_PER_DEVICE, EVENTS_RATE_PER_IP, PUBLIC_CACHE_CONTROL, _absolute_url, _json, _over_limit, _public,
)


def _preview_denied(request):
    """None when the request isn't a preview or its token is right; a 403 otherwise."""
    if 'preview' in request.GET and not announcement_feed.is_preview_token(request.GET['preview']):
        return _json({'error': 'invalid preview token'}, status=403)
    return None


class StoryListView(View):
    """GET /api/v1/stories/ - every listed story with its slides, the same for everyone.

    `?preview=<token>` (the announcements' preview token) also returns the stories in Preview, uncached.
    """

    def get(self, request):
        denied = _preview_denied(request)
        if denied:
            return denied
        if 'preview' in request.GET:
            return _json(story_feed.list_payload(_absolute_url(request), statuses=story_feed.PREVIEW_STATUSES))
        return _public(request, story_feed.public_list(_absolute_url(request)))


class StoryDetailView(View):
    """GET /api/v1/stories/<slug>/ - one story inside its time window."""

    def get(self, request, slug: str):
        denied = _preview_denied(request)
        if denied:
            return denied
        if 'preview' in request.GET:
            payload = story_feed.detail_payload(slug, _absolute_url(request), statuses=story_feed.PREVIEW_STATUSES)
            return _json(payload) if payload else _json({'error': 'not found'}, status=404)
        rendered = story_feed.public_detail(slug, _absolute_url(request))
        if rendered is None:
            response = _json({'error': 'not found'}, status=404)
            response['Cache-Control'] = PUBLIC_CACHE_CONTROL
            response._skip_page_cache = True
            return response
        return _public(request, rendered)


class StoryLikedView(View):
    """GET /api/v1/stories/liked/?device_id=<id> - the listed stories this device liked (never cached)."""

    def get(self, request):
        return _json(story_feed.liked_payload(request.GET.get('device_id', '')))


@method_decorator(csrf_exempt, name='dispatch')
class StoryEventsView(View):
    """POST /api/v1/stories/events/ - views, likes, CTA taps and shares (JSON body, any Content-Type)."""

    def post(self, request):
        ip = safe_ip(client_ip(request))
        if _over_limit(request, 'story-events-ip', ip or '', EVENTS_RATE_PER_IP):
            return _json({'error': 'rate limited'}, status=429)
        try:
            payload = json.loads((request.body or b'{}').decode('utf-8'))
        except (ValueError, UnicodeDecodeError):
            return _json({'error': 'invalid json'}, status=400)
        if not isinstance(payload, dict):
            return _json({'error': 'expected a json object'}, status=400)
        device_id = str(payload.get('device_id') or '').strip()
        if device_id and _over_limit(request, 'story-events-device', device_id, EVENTS_RATE_PER_DEVICE):
            return _json({'error': 'rate limited'}, status=429)
        result = story_events.ingest(payload, country=client_country(request) or '', ip=ip)
        return _json({'status': 'ok', **result})

    def options(self, request, *args, **kwargs):
        response = _json({})
        response['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type'
        response['Access-Control-Max-Age'] = '86400'
        return response


# A person writes a few comments a minute at most; the per-IP rates leave room for phones behind one address.
COMMENTS_RATE_PER_DEVICE = '5/m'
COMMENTS_RATE_PER_IP = '60/m'
COMMENT_READS_RATE_PER_IP = '600/m'


def _json_body(request):
    """The request's JSON object, or a 400 response."""
    try:
        payload = json.loads((request.body or b'{}').decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        return None, _json({'error': 'invalid json'}, status=400)
    if not isinstance(payload, dict):
        return None, _json({'error': 'expected a json object'}, status=400)
    return payload, None


def _per_device(response):
    """Answers that say which comments are the device's ("mine"): never kept by Redis's page cache or a CDN."""
    response._skip_page_cache = True
    return response


def _int(value) -> Optional[int]:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def _comment_options():
    response = _json({})
    response['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS'
    response['Access-Control-Allow-Headers'] = 'Content-Type'
    response['Access-Control-Max-Age'] = '86400'
    return response


@method_decorator(csrf_exempt, name='dispatch')
class StoryCommentsView(View):
    """GET /api/v1/stories/<slug>/comments/ - a page of visible comments, newest first.
    POST /api/v1/stories/<slug>/comments/ - a listener writes one (when the story takes comments).
    """

    def get(self, request, slug: str):
        ip = safe_ip(client_ip(request))
        if _over_limit(request, 'story-comment-reads-ip', ip or '', COMMENT_READS_RATE_PER_IP):
            return _json({'error': 'rate limited'}, status=429)
        story = story_comments.live_story(slug)
        if story is None:
            return _per_device(_json({'error': 'not found'}, status=404))
        device_id = request.GET.get('device_id', '').strip()[:512]
        return _per_device(_json(story_comments.page(story, before=_int(request.GET.get('before')),
                                                     device_id=device_id)))

    def post(self, request, slug: str):
        ip = safe_ip(client_ip(request))
        if _over_limit(request, 'story-comments-ip', ip or '', COMMENTS_RATE_PER_IP):
            return _json({'error': 'rate limited'}, status=429)
        payload, error = _json_body(request)
        if error:
            return error
        device_id = str(payload.get('device_id') or '').strip()[:512]
        if not device_id:
            return _json({'error': 'device_id is required'}, status=400)
        if _over_limit(request, 'story-comments-device', device_id, COMMENTS_RATE_PER_DEVICE):
            return _json({'error': 'rate limited'}, status=429)
        story = story_comments.live_story(slug)
        if story is None:
            return _json({'error': 'not found'}, status=404)
        try:
            comment = story_comments.upsert(story, {**payload, 'device_id': device_id},
                                            country=client_country(request) or '', ip=ip)
        except story_comments.CommentRefused as refused:
            return _json({'error': str(refused)}, status=400)
        return _per_device(_json({'comment': story_comments.serialize(comment, device_id)}, status=201))

    def options(self, request, *args, **kwargs):
        return _comment_options()


@method_decorator(csrf_exempt, name='dispatch')
class StoryCommentDetailView(View):
    """DELETE /api/v1/stories/<slug>/comments/<id>/?device_id=<id> - the author's device deletes its comment."""

    def delete(self, request, slug: str, comment_id: int):
        ip = safe_ip(client_ip(request))
        if _over_limit(request, 'story-comments-ip', ip or '', COMMENTS_RATE_PER_IP):
            return _json({'error': 'rate limited'}, status=429)
        story = story_comments.live_story(slug)
        if story is None:
            return _json({'error': 'not found'}, status=404)
        try:
            deleted = story_comments.delete(story, comment_id, request.GET.get('device_id', '').strip()[:512])
        except story_comments.CommentNotYours:
            return _json({'error': 'not your comment'}, status=403)
        if not deleted:
            return _json({'error': 'not found'}, status=404)
        response = HttpResponse(status=204)
        response['Cache-Control'] = 'private, no-store'
        response['Access-Control-Allow-Origin'] = '*'
        return response

    def options(self, request, *args, **kwargs):
        return _comment_options()
