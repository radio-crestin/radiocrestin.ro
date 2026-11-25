from django.db import models
from django.utils.translation import gettext_lazy as _

from .stories import Story, StorySlide


class StoryEventType(models.TextChoices):
    VIEW = 'view', _('Opened')
    AUTO_OPEN = 'auto_open', _('Opened by itself')
    SLIDE_VIEW = 'slide_view', _('Slide seen')
    COMPLETE = 'complete', _('Watched to the end')
    LIKE = 'like', _('Liked')
    UNLIKE = 'unlike', _('Like taken back')
    CTA_CLICK = 'cta_click', _('CTA tapped')
    SHARE = 'share', _('Shared')


class StoryCtaTarget(models.TextChoices):
    BUTTON = 'button', _('Button')
    SWIPE_UP = 'swipe_up', _('Swipe up')


# Raw events are deleted after this many days (tasks/delete_old_story_events.py); daily totals stay.
RETENTION_DAYS = 180

# Event type -> the Story counter it increments. Likes are counted from StoryLike instead.
STORY_COUNTER_BY_EVENT_TYPE = {
    StoryEventType.VIEW: 'views',
    StoryEventType.AUTO_OPEN: 'auto_opens',
    StoryEventType.SLIDE_VIEW: 'slide_views',
    StoryEventType.COMPLETE: 'completions',
    StoryEventType.CTA_CLICK: 'cta_clicks',
    StoryEventType.SHARE: 'shares',
}
# Event type -> the StorySlide counter it increments, for events that name a slide.
SLIDE_COUNTER_BY_EVENT_TYPE = {
    StoryEventType.SLIDE_VIEW: 'views',
    StoryEventType.CTA_CLICK: 'cta_clicks',
}


class StoryEvent(models.Model):
    """One raw event reported by a device. Deleted after 180 days; totals stay on the story and its slides."""

    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='events')
    slide = models.ForeignKey(StorySlide, on_delete=models.SET_NULL, null=True, blank=True, related_name='events')
    type = models.CharField(_("Type"), max_length=16, choices=StoryEventType.choices)
    target = models.CharField(_("Tapped"), max_length=16, choices=StoryCtaTarget.choices, blank=True, default='')
    device_id = models.CharField(_("Device ID"), max_length=512, blank=True, default='')
    platform = models.CharField(_("Platform"), max_length=32, blank=True, default='')
    app_version = models.CharField(_("App version"), max_length=64, blank=True, default='')
    locale = models.CharField(_("Locale"), max_length=64, blank=True, default='')
    country = models.CharField(_("Country"), max_length=2, blank=True, default='')
    ip = models.GenericIPAddressField(_("IP address"), null=True, blank=True)
    occurred_at = models.DateTimeField(_("Occurred at (client)"), null=True, blank=True)
    created_at = models.DateTimeField(_("Received at"), auto_now_add=True)

    class Meta:
        managed = True
        db_table = 'story_events'
        ordering = ('-created_at',)
        verbose_name = _("Story Event")
        verbose_name_plural = _("Story Events")
        indexes = [
            models.Index(fields=['story', 'created_at'], name='story_event_story_idx'),
            models.Index(fields=['created_at'], name='story_event_time_idx'),
            models.Index(fields=['story', 'type', 'device_id'], name='story_event_uniq_idx'),
        ]

    def __str__(self):
        return f"{self.type} · {self.story_id} · {self.device_id}"


class StoryLike(models.Model):
    """A device's like: one per story and device; an unlike deletes it."""

    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='likes', db_index=False)
    device_id = models.CharField(_("Device ID"), max_length=512)
    platform = models.CharField(_("Platform"), max_length=32, blank=True, default='')
    created_at = models.DateTimeField(_("Liked at"), auto_now_add=True)

    class Meta:
        managed = True
        db_table = 'story_likes'
        ordering = ('-created_at',)
        verbose_name = _("Story Like")
        verbose_name_plural = _("Story Likes")
        constraints = [
            models.UniqueConstraint(fields=['story', 'device_id'], name='story_like_one_per_device'),
        ]
        indexes = [models.Index(fields=['device_id'], name='story_like_device_idx')]

    def __str__(self):
        return f"{self.story_id} · {self.device_id}"


class StoryStatBucket(models.Model):
    """One story's events in one Bucharest calendar day (stored as the UTC instant of its midnight).

    Absolute counts, recomputed from the events (services/story_stat_buckets.py), so they
    outlive the 180-day event retention.
    """

    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='stat_buckets', db_index=False)
    day = models.DateTimeField(_("Day"))
    views = models.PositiveIntegerField(_("Views"), default=0)
    auto_opens = models.PositiveIntegerField(_("Auto-opens"), default=0)
    slide_views = models.PositiveIntegerField(_("Slide views"), default=0)
    completions = models.PositiveIntegerField(_("Watched to the end"), default=0)
    cta_clicks = models.PositiveIntegerField(_("CTA taps"), default=0)
    shares = models.PositiveIntegerField(_("Shares"), default=0)
    likes = models.PositiveIntegerField(_("Likes"), default=0)
    unlikes = models.PositiveIntegerField(_("Likes taken back"), default=0)
    unique_viewers = models.PositiveIntegerField(_("Unique viewers"), default=0)

    class Meta:
        managed = True
        db_table = 'story_stat_buckets'
        ordering = ('story', 'day')
        verbose_name = _("Story Stat Bucket")
        verbose_name_plural = _("Story Stat Buckets")
        constraints = [
            models.UniqueConstraint(fields=['story', 'day'], name='story_stat_bucket_unique'),
        ]

    def __str__(self):
        return f"{self.story_id} · {self.day:%Y-%m-%d}"
