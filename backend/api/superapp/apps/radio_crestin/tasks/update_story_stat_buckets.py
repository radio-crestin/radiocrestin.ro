"""Brings the stories' daily history up to date (every 5 minutes)."""
import logging

from celery import shared_task

from ..services import story_stat_buckets

logger = logging.getLogger(__name__)


@shared_task(ignore_result=True, time_limit=30 * 60)
def update_story_stat_buckets():
    result = story_stat_buckets.upsert_recent()
    if result['buckets']:
        logger.info('Story history: %s days updated', result['buckets'])
    return result
