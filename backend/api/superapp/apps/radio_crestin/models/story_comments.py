from django.db import models
from django.utils.translation import gettext_lazy as _

from .stories import MAX_COMMENT_AUTHOR_CHARS, MAX_COMMENT_CHARS, Story, StorySlide


class StoryComment(models.Model):
    """A listener's public comment under a story (docs/stories-api.md#comments). Hidden ones only the admin sees."""

    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='comments')
    slide = models.ForeignKey(StorySlide, on_delete=models.SET_NULL, null=True, blank=True, related_name='comments')
    text = models.TextField(_("Comment"), max_length=MAX_COMMENT_CHARS)
    author_name = models.CharField(_("Name"), max_length=MAX_COMMENT_AUTHOR_CHARS, blank=True, default='')
    is_hidden = models.BooleanField(
        _("Hidden"), default=False, help_text=_("Hidden comments are kept here but no listener sees them."),
    )
    device_id = models.CharField(_("Device ID"), max_length=512, blank=True, default='')
    platform = models.CharField(_("Platform"), max_length=32, blank=True, default='')
    app_version = models.CharField(_("App version"), max_length=64, blank=True, default='')
    locale = models.CharField(_("Locale"), max_length=64, blank=True, default='')
    country = models.CharField(_("Country"), max_length=2, blank=True, default='')
    ip = models.GenericIPAddressField(_("IP address"), null=True, blank=True)
    created_at = models.DateTimeField(_("Written at"), auto_now_add=True)

    class Meta:
        managed = True
        db_table = 'story_comments'
        ordering = ('-id',)
        verbose_name = _("Story Comment")
        verbose_name_plural = _("Story Comments")
        indexes = [models.Index(fields=['story', 'is_hidden', '-id'], name='story_comment_page_idx')]

    def __str__(self):
        return self.text[:60]
