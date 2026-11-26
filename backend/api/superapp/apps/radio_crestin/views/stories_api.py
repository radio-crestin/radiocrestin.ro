"""The stories API (backend/docs/stories-api.md): the list, one story, a device's likes, and the events."""
import json

from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt

from ..services import announcement_feed, story_events, story_feed
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
