"""Daily history of each story's events (StoryStatBucket), like the announcements' (announcement_stat_buckets.py).

A bucket holds absolute counts recomputed from the raw events, then upserted, so a missed
or repeated run heals itself. upsert_recent() runs every few minutes
(tasks/update_story_stat_buckets.py): the days that got events since the last run, or
everything the events still cover on the first run.
"""
from datetime import datetime, timedelta

from django.db.models import Count, Max, Min, Q
from django.db.models.functions import TruncDay
from django.utils import timezone

from ..models import StatGranularity, StoryEvent, StoryEventType, StorySettings, StoryStatBucket
from ..models.story_events import RETENTION_DAYS, STORY_COUNTER_BY_EVENT_TYPE
from .announcement_stat_buckets import DAY_TIME_ZONE, OVERLAP, bucket_end, bucket_start

COUNTS_BY_EVENT_TYPE = {
    **STORY_COUNTER_BY_EVENT_TYPE,
    StoryEventType.LIKE: 'likes',
    StoryEventType.UNLIKE: 'unlikes',
}
COUNT_FIELDS = [*COUNTS_BY_EVENT_TYPE.values(), 'unique_viewers']
DAY = StatGranularity.DAY


def day_start(moment: datetime) -> datetime:
    return bucket_start(DAY, moment)


def _counts():
    counts = {field: Count('pk', filter=Q(type=event_type)) for event_type, field in COUNTS_BY_EVENT_TYPE.items()}
    counts['unique_viewers'] = Count(
        'device_id', distinct=True, filter=Q(type__in=[StoryEventType.VIEW, StoryEventType.AUTO_OPEN]))
    return counts


def upsert(ranges: dict) -> int:
    """Recomputes the days inside {story_id: (start, end)} (day-aligned) in one query and one upsert."""
    if not ranges:
        return 0
    window = Q()
    for story_id, (start, end) in ranges.items():
        window |= Q(story_id=story_id, created_at__gte=start, created_at__lt=end)
    rows = (
        StoryEvent.objects.filter(window).order_by()
        .annotate(day=TruncDay('created_at', tzinfo=DAY_TIME_ZONE))
        .values('story_id', 'day')
        .annotate(**_counts())
    )
    buckets = [StoryStatBucket(**row) for row in rows]
    StoryStatBucket.objects.bulk_create(
        buckets, batch_size=1000, update_conflicts=True, unique_fields=['story', 'day'], update_fields=COUNT_FIELDS,
    )
    return len(buckets)


def _ranges(spans, cutoff=None) -> dict:
    ranges = {}
    for span in spans:
        first = max(span['first'], cutoff) if cutoff else span['first']
        start = day_start(first)
        if cutoff and start < cutoff:
            start = bucket_end(DAY, start)  # that day may have lost events to the retention: keep its counts
        end = bucket_end(DAY, day_start(span['last']))
        if start < end:
            ranges[span['story_id']] = (start, end)
    return ranges


def _spans(queryset):
    return queryset.order_by().values('story_id').annotate(first=Min('created_at'), last=Max('created_at'))


def upsert_touched_since(since: datetime) -> int:
    return upsert(_ranges(_spans(StoryEvent.objects.filter(created_at__gte=since))))


def upsert_all() -> int:
    return upsert(_ranges(_spans(StoryEvent.objects.all()), cutoff=timezone.now() - timedelta(days=RETENTION_DAYS)))


def upsert_recent() -> dict:
    started = timezone.now()
    settings = StorySettings.load()
    if settings.stats_updated_until is None:
        written = upsert_all()
    else:
        written = upsert_touched_since(settings.stats_updated_until - OVERLAP)
    (StorySettings.objects.filter(pk=settings.pk)
     .filter(Q(stats_updated_until__isnull=True) | Q(stats_updated_until__lt=started))
     .update(stats_updated_until=started))
    return {'buckets': written, 'updated_until': started.isoformat()}
