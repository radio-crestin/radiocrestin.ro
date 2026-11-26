from django.db import models
from django.utils.translation import gettext_lazy as _


class StorySettings(models.Model):
    """Settings for every story (single row)."""

    auto_open_gap_actions = models.PositiveIntegerField(
        _("Actions between two auto-opens"), default=20,
        help_text=_(
            "A phone opens a story by itself only after this many app opens and station plays since the last "
            "story it opened by itself, so stories that open by themselves never come one after another. 0: no gap."
        ),
    )
    stats_updated_until = models.DateTimeField(
        _("History updated until"), null=True, blank=True, editable=False,
        help_text=_("Events received up to this time are in the daily history."),
    )
    created_at = models.DateTimeField(_("Created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Updated at"), auto_now=True)

    class Meta:
        managed = True
        db_table = 'story_settings'
        verbose_name = _("Story Settings")
        verbose_name_plural = _("Story Settings")

    def __str__(self):
        return str(_("Story settings"))

    @classmethod
    def load(cls) -> 'StorySettings':
        """The single settings row, created on first use."""
        return cls.objects.order_by('pk').first() or cls.objects.create()
