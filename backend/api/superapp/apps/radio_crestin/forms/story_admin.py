"""The story and slide edit forms: the announcements' audience fields, and the video checks on upload."""
import re

from django import forms
from django.core.files.images import get_image_dimensions
from django.core.files.uploadedfile import UploadedFile
from django.utils.translation import gettext_lazy as _
from unfold.widgets import UnfoldAdminCheckboxSelectMultipleWidget

from ..models import SlideType, Story, StorySlide, TargetPlatform
from ..models.stories import MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS
from ..services import story_media
from .announcement_admin import LOCALE_PATTERN, ListTextField

# /api/v1/stories/liked/ and /api/v1/stories/events/ are endpoints.
RESERVED_SLUGS = {'liked', 'events'}

VIDEO_REJECTIONS = {
    'unreadable': _('This video could not be read. Upload an MP4 file (H.264).'),
    'no_ffmpeg': _('Videos can\'t be checked on this server (ffprobe is missing): ask a developer.'),
}


class StoryAdminForm(forms.ModelForm):
    platforms = forms.MultipleChoiceField(
        label=_('Platforms'), choices=TargetPlatform.choices, required=False,
        widget=UnfoldAdminCheckboxSelectMultipleWidget,
        help_text=_('None ticked means everywhere the stories bar exists (the apps).'),
    )
    countries_include = ListTextField(
        label=_('Only in countries'), normalize=str.upper, validate_item=lambda item: re.fullmatch(r'[A-Z]{2}', item),
        help_text=_('ISO codes such as RO, MD, DE. Empty means everyone.'),
    )
    countries_exclude = ListTextField(
        label=_('Except countries'), normalize=str.upper, validate_item=lambda item: re.fullmatch(r'[A-Z]{2}', item),
    )
    locales = ListTextField(
        label=_('Languages'), validate_item=LOCALE_PATTERN.match,
        help_text=_('Language codes such as ro, en or hu; ro also matches ro-RO and ro_RO.'),
    )

    class Meta:
        model = Story
        exclude = ['views', 'auto_opens', 'completions', 'slide_views', 'cta_clicks', 'shares', 'like_count']

    def clean_slug(self):
        slug = self.cleaned_data['slug']
        if slug in RESERVED_SLUGS:
            raise forms.ValidationError(_('This slug is reserved.'))
        return slug


class StorySlideForm(forms.ModelForm):
    """Checks an uploaded video's length and size, and fills what the API sends about the media."""

    class Meta:
        model = StorySlide
        exclude = ['views', 'cta_clicks']

    def clean(self):
        data = super().clean()
        slide_type = data.get('type')
        video = data.get('video')
        if slide_type == SlideType.VIDEO and isinstance(video, UploadedFile):
            self._check_video(video, data)
        image = data.get('image')
        if slide_type == SlideType.IMAGE and isinstance(image, UploadedFile):
            width, height = get_image_dimensions(image)
            self.instance.media_width, self.instance.media_height = width, height
            self.instance.media_size_bytes = image.size
        return data

    def _check_video(self, video, data):
        if video.size > MAX_VIDEO_BYTES:
            self.add_error('video', _('This video is %(size)s MB: at most %(max)s MB.') % {
                'size': round(video.size / 1024 / 1024, 1), 'max': MAX_VIDEO_BYTES // 1024 // 1024})
            return
        try:
            with story_media.local_path(video) as path:
                info = story_media.probe(path)
                if info.seconds > MAX_VIDEO_SECONDS + 0.5:
                    self.add_error('video', _(
                        'This video is %(seconds)s seconds long: at most %(max)s. Upload a short teaser, and link '
                        'the whole video from the call to action.') % {
                        'seconds': round(info.seconds), 'max': MAX_VIDEO_SECONDS})
                    return
                if not data.get('poster') and not self.instance.poster:
                    poster = story_media.poster_frame(path, info.seconds)
                    if poster is not None:
                        poster.name = f'{(video.name or "video").rsplit(".", 1)[0]}.jpg'
                        self.instance.poster = poster
        except story_media.MediaError as error:
            self.add_error('video', VIDEO_REJECTIONS.get(error.code, VIDEO_REJECTIONS['unreadable']))
            return
        instance = self.instance
        instance.video_seconds, instance.has_sound = info.seconds, info.has_sound
        instance.media_width, instance.media_height, instance.media_size_bytes = info.width, info.height, video.size
