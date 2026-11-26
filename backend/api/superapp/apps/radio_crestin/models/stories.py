"""Stories: full-screen slides shown in a bar at the top of the app (backend/docs/stories-api.md)."""
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator, MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from ...storage.config import get_public_storage
from .announcement_validators import validate_app_url, validate_intent_uri, validate_public_slug, validate_web_url
from .announcements import Announcement, AnnouncementStatus
from .forms import Form
from .songs import Songs
from .stations import Stations

# A story uses the announcements' statuses: draft, preview (only with the preview link), active.
StoryStatus = AnnouncementStatus

VIDEO_EXTENSIONS = ('mp4',)
IMAGE_EXTENSIONS = ('jpg', 'jpeg', 'png', 'webp')
MAX_VIDEO_SECONDS = 60
MAX_VIDEO_BYTES = 50 * 1024 * 1024
DEFAULT_SECONDS = {'image': 6, 'video': 15, 'youtube': 15, 'instagram': 10}
MAX_SLIDE_SECONDS = 120
MAX_COMMENT_CHARS = 500

# A CTA's colours, as the clients take them: #RRGGBB, or #AARRGGBB with the opacity first.
validate_hex_color = RegexValidator(
    r'^#([0-9A-Fa-f]{2})?[0-9A-Fa-f]{6}$',
    _('Enter a colour as #RRGGBB, such as #FFC107, or #AARRGGBB with the opacity first, such as #80000000.'),
    code='invalid_color',
)


class SlideType(models.TextChoices):
    IMAGE = 'image', _('Image')
    VIDEO = 'video', _('Video (uploaded)')
    YOUTUBE = 'youtube', _('YouTube video')
    INSTAGRAM = 'instagram', _('Instagram post or reel')


class Orientation(models.TextChoices):
    LANDSCAPE = 'landscape', _('Landscape')
    PORTRAIT = 'portrait', _('Portrait')


class CtaStyle(models.TextChoices):
    NONE = 'none', _('No call to action')
    SWIPE_UP = 'swipe_up', _('"Swipe up" hint')
    BUTTON = 'button', _('Button')
    BOTH = 'both', _('Button, and swipe up too')


class CtaTarget(models.TextChoices):
    URL = 'url', _('Web page')
    APP_LINK = 'app_link', _('Another app (YouTube, Instagram, Spotify...)')
    IN_APP = 'in_app', _('A screen of our app')
    STORY = 'story', _('Another story')


class OpenIn(models.TextChoices):
    IN_APP_BROWSER = 'in_app_browser', _('In-app browser')
    BROWSER = 'browser', _('The phone\'s browser')


class CtaApp(models.TextChoices):
    YOUTUBE = 'youtube', 'YouTube'
    INSTAGRAM = 'instagram', 'Instagram'
    SPOTIFY = 'spotify', 'Spotify'
    FACEBOOK = 'facebook', 'Facebook'
    WHATSAPP = 'whatsapp', 'WhatsApp'
    TIKTOK = 'tiktok', 'TikTok'
    OTHER = 'other', _('Other')


class InAppRoute(models.TextChoices):
    STATION = 'station', _('Station')
    SONG = 'song', _('Song')
    ANNOUNCEMENT = 'announcement', _('Announcement page')
    FORM = 'form', _('Form')
    SHARE = 'share', _('Share the app')
    SETTINGS = 'settings', _('Settings')


class Story(models.Model):
    """One story: its slides, when it is listed, who sees it, and how often each device sees it again."""

    slug = models.SlugField(
        _("Slug"), max_length=100, unique=True, validators=[validate_public_slug],
        help_text=_("In the share link and the stats. Devices remember what they saw per slug."),
    )
    title = models.CharField(_("Title"), max_length=120)
    status = models.CharField(_("Status"), max_length=16, choices=StoryStatus.choices, default=StoryStatus.DRAFT)
    position = models.PositiveIntegerField(
        _("Position"), blank=True, db_index=True,
        help_text=_("Order in the stories bar, lowest first: drag the rows in the Stories list. New ones go last."),
    )
    cover_image = models.ImageField(
        _("Cover"), storage=get_public_storage, upload_to='stories/covers/', blank=True, null=True,
        validators=[FileExtensionValidator(IMAGE_EXTENSIONS)],
        help_text=_("The round picture in the stories bar; square works best. Empty: the first slide's picture."),
    )

    # When it is listed
    starts_at = models.DateTimeField(_("Starts at"), default=timezone.now)
    ends_at = models.DateTimeField(_("Ends at"), null=True, blank=True)

    # How often a device sees it (counted on the device; docs/stories-api.md#display-rules)
    auto_open = models.BooleanField(
        _("Open it by itself"), default=False,
        help_text=_("The app opens it full screen when it is due, instead of waiting for a tap."),
    )
    every_days = models.PositiveIntegerField(
        _("Again after days"), null=True, blank=True, validators=[MinValueValidator(1)],
        help_text=_("After a device saw it, it is new again after this many days. Empty: only once."),
    )
    every_actions = models.PositiveIntegerField(
        _("Again after actions"), null=True, blank=True, validators=[MinValueValidator(1)],
        help_text=_("...or after this many app opens and station plays, whichever comes first."),
    )
    max_shows = models.PositiveIntegerField(
        _("Max shows per device"), null=True, blank=True, validators=[MinValueValidator(1)],
        help_text=_("After a device saw it this many times, it leaves the stories bar there. Empty: no limit."),
    )

    # Public comments under the story (docs/stories-api.md#comments)
    comments_enabled = models.BooleanField(
        _("Comments"), default=False,
        help_text=_("Listeners can read and write public comments under the story. Moderate them in Story Comments."),
    )
    comments_placeholder = models.CharField(
        _("Comment placeholder"), max_length=120, blank=True, default='',
        help_text=_("The hint in the empty comment box, e.g. \"Scrie un gând\". Empty: the app's own."),
    )

    # The account row under the call to action
    author = models.ForeignKey(
        'Profile', verbose_name=_("Author"), on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
        help_text=_("Its name and avatar are shown under the call to action. Empty: \"Radio Creștin\" with its logo."),
    )

    # Who sees it: the announcements' filters, applied on the device
    platforms = models.JSONField(_("Platforms"), default=list, blank=True)
    countries_include = models.JSONField(_("Only in countries"), default=list, blank=True)
    countries_exclude = models.JSONField(_("Except countries"), default=list, blank=True)
    locales = models.JSONField(_("Languages"), default=list, blank=True)
    min_app_version = models.CharField(_("Min app version"), max_length=32, blank=True, default='')
    max_app_version = models.CharField(_("Max app version"), max_length=32, blank=True, default='')

    # Totals, updated from the reported events
    views = models.PositiveBigIntegerField(_("Views"), default=0)
    auto_opens = models.PositiveBigIntegerField(_("Auto-opens"), default=0)
    completions = models.PositiveBigIntegerField(_("Watched to the end"), default=0)
    slide_views = models.PositiveBigIntegerField(_("Slide views"), default=0)
    cta_clicks = models.PositiveBigIntegerField(_("CTA taps"), default=0)
    shares = models.PositiveBigIntegerField(_("Shares"), default=0)
    like_count = models.PositiveBigIntegerField(_("Likes"), default=0)

    created_at = models.DateTimeField(_("Created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Updated at"), auto_now=True)

    class Meta:
        managed = True
        db_table = 'stories'
        ordering = ('position', 'id')
        verbose_name = _("Story")
        verbose_name_plural = _("Stories")
        indexes = [models.Index(fields=['status', 'ends_at'], name='story_status_idx')]

    def __str__(self):
        return self.title

    def clean(self):
        super().clean()
        errors = {}
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            errors['ends_at'] = _('The end must be after the start.')
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.position is None:  # a new story goes last
            last = Story.objects.aggregate(last=models.Max('position'))['last']
            self.position = 0 if last is None else last + 1
        super().save(*args, **kwargs)

    def is_live(self, now=None) -> bool:
        now = now or timezone.now()
        return (self.status == StoryStatus.ACTIVE and self.starts_at <= now
                and (self.ends_at is None or self.ends_at > now))


class StorySlide(models.Model):
    """One full-screen slide of a story, with its optional call to action."""

    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='slides')
    position = models.PositiveIntegerField(_("Position"), default=0, db_index=True)
    type = models.CharField(_("Type"), max_length=16, choices=SlideType.choices, default=SlideType.IMAGE)

    # Media: the one its type needs
    image = models.ImageField(
        _("Image"), storage=get_public_storage, upload_to='stories/slides/', blank=True, null=True,
        validators=[FileExtensionValidator(IMAGE_EXTENSIONS)],
    )
    video = models.FileField(
        _("Video"), storage=get_public_storage, upload_to='stories/videos/', blank=True, null=True,
        validators=[FileExtensionValidator(VIDEO_EXTENSIONS)],
        help_text=_("MP4 (H.264), at most 60 seconds and 50 MB. A short teaser works best."),
    )
    poster = models.ImageField(
        _("Poster frame"), storage=get_public_storage, upload_to='stories/posters/', blank=True, null=True,
        validators=[FileExtensionValidator(IMAGE_EXTENSIONS)],
        help_text=_("Shown while the video loads. Empty: taken from the video's first second when it is saved."),
    )
    youtube_url = models.CharField(_("YouTube link"), max_length=500, blank=True, default='')
    instagram_url = models.CharField(
        _("Instagram link"), max_length=500, blank=True, default='',
        help_text=_(
            "A post or reel link, such as https://www.instagram.com/reel/C1a2B3c4D5e/. With the "
            "INSTAGRAM_OEMBED_TOKEN setting (a Meta app token, set in the backend's environment), saving "
            "also fetches its picture, author and caption, so the app can show it as a slide; without it, the "
            "app shows the post in Instagram's own embed or as a link to open in Instagram."
        ),
    )
    embed_details = models.JSONField(
        _("Fetched details"), default=dict, blank=True, editable=False,
        help_text=_("Fetched from YouTube or Instagram when the slide is saved, so the app never waits for them."),
    )

    orientation = models.CharField(
        _("Orientation"), max_length=16, choices=Orientation.choices, default=Orientation.LANDSCAPE,
    )
    duration_seconds = models.FloatField(
        _("Shown for (seconds)"), null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(MAX_SLIDE_SECONDS)],
        help_text=_("Empty: 6 s for an image, the video's own length, 15 s for YouTube, 10 s for Instagram."),
    )

    # Read from the uploaded file when it is saved
    media_width = models.PositiveIntegerField(_("Width"), null=True, blank=True, editable=False)
    media_height = models.PositiveIntegerField(_("Height"), null=True, blank=True, editable=False)
    media_size_bytes = models.PositiveBigIntegerField(_("Size (bytes)"), null=True, blank=True, editable=False)
    video_seconds = models.FloatField(_("Video length (seconds)"), null=True, blank=True, editable=False)
    has_sound = models.BooleanField(_("Has sound"), default=False, editable=False)

    caption = models.TextField(
        _("Caption"), max_length=500, blank=True, default='',
        help_text=_("Text over the bottom of the slide, like a Reels caption. Empty: none."),
    )

    # Call to action
    cta_style = models.CharField(_("Call to action"), max_length=16, choices=CtaStyle.choices, default=CtaStyle.NONE)
    cta_label = models.CharField(
        _("Label"), max_length=60, blank=True, default='',
        help_text=_("The button's text, or what the swipe-up hint says, e.g. \"Watch the whole video\"."),
    )
    cta_target = models.CharField(_("Opens"), max_length=16, choices=CtaTarget.choices, default=CtaTarget.URL)
    cta_url = models.CharField(_("Web page"), max_length=2000, blank=True, default='', validators=[validate_web_url])
    cta_open_in = models.CharField(
        _("Open in"), max_length=16, choices=OpenIn.choices, default=OpenIn.IN_APP_BROWSER,
    )
    cta_app = models.CharField(_("App"), max_length=16, choices=CtaApp.choices, default=CtaApp.YOUTUBE)
    cta_app_url = models.CharField(
        _("App link"), max_length=2000, blank=True, default='', validators=[validate_app_url],
        help_text=_("The link the app opens: https://youtu.be/..., https://www.instagram.com/..., "
                    "spotify:track:..., fb://..."),
    )
    cta_android_intent_uri = models.TextField(
        _("Android intent URI"), blank=True, default='', validators=[validate_intent_uri],
        help_text=_("Optional, tried first on Android: intent://...#Intent;package=...;end"),
    )
    cta_fallback_url = models.CharField(
        _("Fallback web page"), max_length=2000, blank=True, default='', validators=[validate_web_url],
        help_text=_("Opened when the app isn't installed, or by app versions that can't open the target."),
    )
    cta_route = models.CharField(_("Screen"), max_length=16, choices=InAppRoute.choices, default=InAppRoute.STATION)
    cta_station = models.ForeignKey(
        Stations, verbose_name=_("Station"), on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
    )
    cta_song = models.ForeignKey(
        Songs, verbose_name=_("Song"), on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
    )
    cta_announcement = models.ForeignKey(
        Announcement, verbose_name=_("Announcement"), on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+',
    )
    cta_form = models.ForeignKey(
        Form, verbose_name=_("Form"), on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
    )
    cta_share_text = models.CharField(_("Text to share"), max_length=300, blank=True, default='')
    cta_story = models.ForeignKey(
        Story, verbose_name=_("Story"), on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
    )
    cta_color = models.CharField(
        _("Button colour"), max_length=9, blank=True, default='', validators=[validate_hex_color],
        help_text=_("#RRGGBB, or #AARRGGBB with the opacity first. Empty: the app's colour."),
    )
    cta_text_color = models.CharField(
        _("Button text colour"), max_length=9, blank=True, default='', validators=[validate_hex_color],
        help_text=_("#RRGGBB, or #AARRGGBB with the opacity first. Empty: the app's colour."),
    )

    # Totals, updated from the reported events
    views = models.PositiveBigIntegerField(_("Views"), default=0)
    cta_clicks = models.PositiveBigIntegerField(_("CTA taps"), default=0)

    created_at = models.DateTimeField(_("Created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Updated at"), auto_now=True)

    class Meta:
        managed = True
        db_table = 'story_slides'
        ordering = ('story', 'position', 'id')
        verbose_name = _("Story Slide")
        verbose_name_plural = _("Story Slides")

    def __str__(self):
        return f'{self.position + 1}. {self.get_type_display()}'

    @property
    def shown_seconds(self) -> float:
        if self.duration_seconds:
            return self.duration_seconds
        if self.type == SlideType.VIDEO and self.video_seconds:
            return round(self.video_seconds, 1)
        return DEFAULT_SECONDS[self.type]

    def clean(self):
        super().clean()
        errors = {}
        errors.update(self._media_errors())
        errors.update(self._cta_errors())
        if errors:
            raise ValidationError(errors)

    def _media_errors(self) -> dict:
        from ..services import instagram_embeds, youtube_embeds

        if self.type == SlideType.IMAGE and not self.image:
            return {'image': _('Upload the image.')}
        if self.type == SlideType.VIDEO and not self.video:
            return {'video': _('Upload the video.')}
        if self.type == SlideType.YOUTUBE:
            if not self.youtube_url:
                return {'youtube_url': _('Paste the YouTube link.')}
            embed = youtube_embeds.parse(self.youtube_url)
            if embed is None:
                return {'youtube_url': _('Paste a link to a YouTube video, Short or playlist.')}
            self.youtube_url = embed.url
        if self.type == SlideType.INSTAGRAM:
            if not self.instagram_url:
                return {'instagram_url': _('Paste the Instagram link.')}
            post = instagram_embeds.parse(self.instagram_url)
            if post is None:
                return {'instagram_url': _('Paste a link to an Instagram post or reel.')}
            self.instagram_url = post.url
        return {}

    def _cta_errors(self) -> dict:
        if self.cta_style == CtaStyle.NONE:
            return {}
        errors = {}
        if not self.cta_label.strip():
            errors['cta_label'] = _('Write what the button or the swipe-up hint says.')
        target = self.cta_target
        if target == CtaTarget.URL and not self.cta_url:
            errors['cta_url'] = _('This needs a web page.')
        elif target == CtaTarget.APP_LINK:
            if not self.cta_app_url:
                errors['cta_app_url'] = _('This needs the app\'s link.')
            if not self.cta_fallback_url:
                errors['cta_fallback_url'] = _('Phones without the app open this page.')
        elif target == CtaTarget.IN_APP:
            needed = {
                InAppRoute.STATION: ('cta_station', _('Pick the station.')),
                InAppRoute.SONG: ('cta_song', _('Pick the song.')),
                InAppRoute.ANNOUNCEMENT: ('cta_announcement', _('Pick the announcement.')),
                InAppRoute.FORM: ('cta_form', _('Pick the form.')),
            }.get(self.cta_route)
            if needed and not getattr(self, f'{needed[0]}_id'):
                errors[needed[0]] = needed[1]
        elif target == CtaTarget.STORY:
            if not self.cta_story_id:
                errors['cta_story'] = _('Pick the story.')
            elif self.cta_story_id == self.story_id:
                errors['cta_story'] = _('Pick another story than this one.')
        return errors
