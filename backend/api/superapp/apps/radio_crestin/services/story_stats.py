"""The numbers the stories admin shows: list columns, and the change page's totals, slides and days."""
from datetime import timedelta

from django.db.models import Count, IntegerField, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from ..models import Story, StoryEvent, StoryEventType, StoryStatBucket
from .story_stat_buckets import day_start

HISTORY_DAYS = 30
OPEN_TYPES = (StoryEventType.VIEW, StoryEventType.AUTO_OPEN)


def with_list_counts(queryset):
    """Each story's slide count and unique viewers (devices that opened it, over the kept events)."""
    viewers = (
        StoryEvent.objects.filter(story=OuterRef('pk'), type__in=OPEN_TYPES).order_by()
        .values('story').annotate(count=Count('device_id', distinct=True)).values('count')
    )
    return queryset.annotate(
        slide_count=Count('slides', distinct=True),
        unique_viewers=Coalesce(Subquery(viewers, output_field=IntegerField()), 0),
    )


def _rate(part, whole):
    return f'{part / whole * 100:.1f}%' if whole else '-'


def summary(story: Story) -> dict:
    """Totals, per-slide counts and the last HISTORY_DAYS days, for templates/admin/.../story/stats.html."""
    unique_viewers = (StoryEvent.objects.filter(story=story, type__in=OPEN_TYPES)
                      .values('device_id').distinct().count())
    opens = story.views + story.auto_opens
    slides = list(story.slides.order_by('position', 'id'))
    since = day_start(timezone.now() - timedelta(days=HISTORY_DAYS - 1))
    days = StoryStatBucket.objects.filter(story=story, day__gte=since).order_by('-day')
    return {
        'totals': [
            (_('Opened'), story.views), (_('Opened by itself'), story.auto_opens), (_('Unique viewers'), unique_viewers),
            (_('Watched to the end'), story.completions), (_('Likes'), story.like_count),
            (_('CTA taps'), story.cta_clicks), (_('Shares'), story.shares),
        ],
        'completion_rate': _rate(story.completions, opens),
        'like_rate': _rate(story.like_count, unique_viewers),
        'slides': [
            {'number': index + 1, 'type': slide.get_type_display(), 'views': slide.views,
             'cta_clicks': slide.cta_clicks, 'cta_rate': _rate(slide.cta_clicks, slide.views),
             'has_cta': slide.cta_style != 'none'}
            for index, slide in enumerate(slides)
        ],
        'days': list(days),
        'history_days': HISTORY_DAYS,
    }
