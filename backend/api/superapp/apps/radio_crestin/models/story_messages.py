from django.db import models
from django.utils.translation import gettext_lazy as _

from .stories import MAX_MESSAGE_CHARS, Story, StorySlide


class StoryMessage(models.Model):
    """A listener's message written under a story that takes messages (docs/stories-api.md#messages)."""

    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='messages')
    slide = models.ForeignKey(StorySlide, on_delete=models.SET_NULL, null=True, blank=True, related_name='messages')
    text = models.TextField(_("Message"), max_length=MAX_MESSAGE_CHARS)
    device_id = models.CharField(_("Device ID"), max_length=512, blank=True, default='')
    platform = models.CharField(_("Platform"), max_length=32, blank=True, default='')
    app_version = models.CharField(_("App version"), max_length=64, blank=True, default='')
    locale = models.CharField(_("Locale"), max_length=64, blank=True, default='')
    country = models.CharField(_("Country"), max_length=2, blank=True, default='')
    ip = models.GenericIPAddressField(_("IP address"), null=True, blank=True)
    created_at = models.DateTimeField(_("Received at"), auto_now_add=True)

    class Meta:
        managed = True
        db_table = 'story_messages'
        ordering = ('-created_at',)
        verbose_name = _("Story Message")
        verbose_name_plural = _("Story Messages")
        indexes = [models.Index(fields=['story', 'created_at'], name='story_message_story_idx')]

    def __str__(self):
        return self.text[:60]
