from django.db import models
from django.utils.translation import gettext_lazy as _

from .profiles import Profile
from .stories import MAX_COMMENT_CHARS, Story, StorySlide
from .users import AppUsers


class StoryComment(models.Model):
    """A public comment under a story (docs/stories-api.md#comments), written by one of the app's users.

    It is shown under its profile's name and avatar ("Ascultător" without one). Hidden ones only the admin sees.
    """

    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='comments')
    slide = models.ForeignKey(StorySlide, on_delete=models.SET_NULL, null=True, blank=True, related_name='comments')
    text = models.TextField(_("Comment"), max_length=MAX_COMMENT_CHARS)
    user = models.ForeignKey(AppUsers, verbose_name=_("App user"), on_delete=models.CASCADE,
                             related_name='story_comments')
    profile = models.ForeignKey(
        Profile, verbose_name=_("Profile"), on_delete=models.SET_NULL, null=True, blank=True, related_name='comments',
        help_text=_("The profile it was written as."),
    )
    is_hidden = models.BooleanField(
        _("Hidden"), default=False, help_text=_("Hidden comments are kept here but no listener sees them."),
    )
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
