from django.core.validators import FileExtensionValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from ...storage.config import get_public_storage
from .users import AppUsers

PROFILE_NAME_CHARS = 40
AVATAR_EXTENSIONS = ('jpg', 'jpeg', 'png', 'webp')


class Profile(models.Model):
    """A public identity: the name and avatar shown on a story's author row and on comments.

    Only the team creates profiles (in the admin); there is no API for them. A profile linked to an
    app user (a device) lets that device write comments under its name.
    """

    name = models.CharField(_("Name"), max_length=PROFILE_NAME_CHARS)
    avatar = models.ImageField(
        _("Avatar"), storage=get_public_storage, upload_to='profiles/', blank=True, null=True,
        validators=[FileExtensionValidator(AVATAR_EXTENSIONS)],
        help_text=_("Square works best. Empty: the app shows the name without a picture."),
    )
    app_user = models.OneToOneField(
        AppUsers, verbose_name=_("App user"), on_delete=models.SET_NULL, null=True, blank=True,
        related_name='profile',
        help_text=_("The device that writes comments as this profile. Empty: the profile only signs stories."),
    )
    created_at = models.DateTimeField(_("Created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Updated at"), auto_now=True)

    class Meta:
        managed = True
        db_table = 'profiles'
        ordering = ('name', 'id')
        verbose_name = _("Profile")
        verbose_name_plural = _("Profiles")

    def __str__(self):
        return self.name
