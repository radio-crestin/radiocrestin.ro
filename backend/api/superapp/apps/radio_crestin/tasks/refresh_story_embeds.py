"""Fetches the Instagram details of listed stories' slides again (daily): Instagram's thumbnail links expire.

Does nothing until INSTAGRAM_OEMBED_TOKEN is set (services/instagram_embeds.py).
"""
import logging

from celery import shared_task

from ..models import SlideType, StorySlide
from ..services import instagram_embeds, story_embeds, story_feed

logger = logging.getLogger(__name__)


@shared_task(ignore_result=True, time_limit=30 * 60)
def refresh_story_embeds():
    if not instagram_embeds.is_configured():
        return {'refreshed': 0, 'skipped': 'no token'}
    slides = StorySlide.objects.filter(
        type=SlideType.INSTAGRAM, story__in=story_feed.listed(story_feed.PREVIEW_STATUSES))
    refreshed = story_embeds.refresh(slides)
    if refreshed:
        logger.info('Story embeds: %s Instagram slides refreshed', refreshed)
    return {'refreshed': refreshed}
