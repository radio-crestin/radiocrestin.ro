import unfold.decorators
from django.contrib import admin, messages
from django.shortcuts import get_object_or_404, redirect
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _

from superapp.apps.admin_portal.admin import SuperAppModelAdmin, SuperAppStackedInline
from superapp.apps.admin_portal.sites import superapp_admin_site
from ..forms.story_admin import StoryAdminForm, StorySlideForm
from ..models import AnnouncementSettings, SlideType, Story, StoryComment, StorySettings, StorySlide
from ..services import announcement_order, instagram_embeds, story_embeds, story_feed, story_stats


RECENT_COMMENTS = 20


def _number(value):
    return f'{value or 0:,}'


def _css_color(value):
    """The API's #AARRGGBB as CSS's #RRGGBBAA; #RRGGBB as it is."""
    if value and len(value) == 9:
        return f'#{value[3:]}{value[1:3]}'
    return value


def _comments_url(story):
    return reverse('admin:radio_crestin_storycomment_changelist') + f'?story__id__exact={story.pk}'


class StorySlideInline(SuperAppStackedInline):
    model = StorySlide
    fk_name = 'story'
    form = StorySlideForm
    extra = 0
    min_num = 1
    ordering_field = 'position'
    hide_ordering_field = True
    autocomplete_fields = ['cta_station', 'cta_song', 'cta_announcement', 'cta_form', 'cta_story']
    readonly_fields = ['media_info_display']
    fieldsets = [
        (None, {'fields': [
            'position', 'type', 'orientation', 'duration_seconds',
            'image', 'video', 'poster', 'youtube_url', 'instagram_url', 'media_info_display', 'caption',
        ]}),
        (_('Call to action'), {'fields': [
            'cta_style', 'cta_label', 'cta_target',
            'cta_url', 'cta_open_in',
            'cta_app', 'cta_app_url', 'cta_android_intent_uri',
            'cta_route', 'cta_station', 'cta_song', 'cta_announcement', 'cta_form', 'cta_share_text',
            'cta_story', 'cta_fallback_url', ('cta_color', 'cta_text_color'),
        ]}),
    ]
    verbose_name_plural = _('Slides (drag to reorder; the preview above shows them after Save)')

    @admin.display(description=_('Media details'))
    def media_info_display(self, obj):
        if not obj or not obj.pk:
            return '-'
        parts = []
        if obj.media_width and obj.media_height:
            parts.append(f'{obj.media_width}×{obj.media_height}')
        if obj.video_seconds:
            parts.append(f'{obj.video_seconds:.1f} s')
            parts.append(str(_('with sound') if obj.has_sound else _('no sound')))
        if obj.media_size_bytes:
            parts.append(f'{obj.media_size_bytes / 1024 / 1024:.1f} MB')
        details = obj.embed_details or {}
        if obj.type == SlideType.YOUTUBE and details.get('title'):
            parts.append(details['title'])
        if obj.type == SlideType.INSTAGRAM:
            if len(details) > 1:
                parts.append(' · '.join(filter(None, [details.get('author_name'), details.get('caption')]))
                             or str(_('details fetched')))
            elif not instagram_embeds.is_configured():
                parts.append(str(_('Only the link is stored: INSTAGRAM_OEMBED_TOKEN is not set.')))
            else:
                parts.append(str(_('Instagram gave no details for this link; saving again tries again.')))
        return ' · '.join(parts) or '-'


@admin.register(Story, site=superapp_admin_site)
class StoryAdmin(SuperAppModelAdmin):
    form = StoryAdminForm
    inlines = [StorySlideInline]
    list_display = [
        'title', 'slug', 'status', 'starts_at', 'ends_at', 'slide_count',
        'views', 'unique_viewers_display', 'like_count', 'cta_clicks', 'shares', 'comment_count_display',
    ]
    ordering = ['position', 'id']
    ordering_field = 'position'
    hide_ordering_field = True
    list_before_template = 'admin/radio_crestin/announcement/list_before.html'
    autocomplete_fields = ['author']
    MAX_REORDER_ROWS = 1000
    list_filter = ['status', 'auto_open', 'comments_enabled']
    search_fields = ['title', 'slug']
    readonly_fields = [
        'preview_display', 'stats_display', 'links_display', 'recent_comments_display',
        'views', 'auto_opens', 'completions', 'slide_views', 'cta_clicks', 'shares', 'like_count',
        'created_at', 'updated_at',
    ]
    actions = ['refresh_embeds_action']
    actions_detail = ['refresh_embeds']

    def get_fieldsets(self, request, obj=None):
        fieldsets = [
            (_('Story'), {'classes': ['tab'], 'fields': [
                'title', 'slug', 'status', 'cover_image', ('starts_at', 'ends_at'),
            ]}),
            (_('How often'), {'classes': ['tab'], 'description': _(
                "Counted on each device. A story is new on a device until it is seen; with \"Again after\", it is "
                "new again after that many days or actions (app opens and station plays), whichever comes first. "
                "Changing the slug starts every count again."), 'fields': [
                'auto_open', ('every_days', 'every_actions'), 'max_shows',
            ]}),
            (_('Who sees it'), {'classes': ['tab'], 'description': _(
                "Everything active is in the public list; filters only decide where it is shown, they don't keep "
                "it secret. Use the Preview status for unpublished stories."), 'fields': [
                'platforms', 'countries_include', 'countries_exclude', 'locales',
                ('min_app_version', 'max_app_version'),
            ]}),
            (_('Comments and author'), {'classes': ['tab'], 'description': _(
                "With comments on, listeners read the story's public comments, and devices linked to a Profile write "
                "them (Story Settings decides whether others may too); hide or delete them in Story Comments. The "
                "author is the profile on the account row under the call to action."), 'fields': [
                'comments_enabled', 'comments_placeholder', 'author',
            ]}),
        ]
        if obj is None:
            return fieldsets
        return [
            (_('Preview'), {'fields': ['preview_display', 'links_display']}),
            *fieldsets,
            (_('Stats'), {'classes': ['tab'], 'fields': [
                'stats_display',
                ('views', 'auto_opens', 'completions'), ('slide_views', 'cta_clicks', 'shares', 'like_count'),
                ('created_at', 'updated_at'),
            ]}),
            (_('Comments'), {'classes': ['tab'], 'fields': ['recent_comments_display']}),
        ]

    def get_object(self, request, object_id, from_field=None):
        """The preview builds the same absolute media URLs as the API, from this request's host."""
        obj = super().get_object(request, object_id, from_field)
        if obj is not None:
            obj._absolute_url = lambda url: request.build_absolute_uri(url) if url.startswith('/') else url
        return obj

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        if request.resolver_match and request.resolver_match.url_name.endswith('_changelist'):
            queryset = story_stats.with_list_counts(queryset)
        return queryset

    def changelist_view(self, request, extra_context=None):
        if request.method == 'POST' and '_save' in request.POST and self.has_change_permission(request):
            response = self._save_order(request)
            if response is not None:
                return response
        return super().changelist_view(request, extra_context)

    def _save_order(self, request):
        """The list's Save after a drag (see AnnouncementAdmin._save_order)."""
        try:
            total = int(request.POST['form-TOTAL_FORMS'])
            rows = sorted(
                (int(request.POST[f'form-{index}-position']), index, int(request.POST[f'form-{index}-id']))
                for index in range(min(total, self.MAX_REORDER_ROWS))
            )
        except (KeyError, ValueError):
            return None
        moved = announcement_order.reorder_rows(Story, [story_id for _, _, story_id in rows],
                                                story_feed.invalidate_cache)
        self.message_user(request, _('Order saved: %(count)s stories moved.') % {'count': moved}, messages.SUCCESS)
        return redirect(request.get_full_path())

    # ------------------------------------------------------------ list columns

    @admin.display(description=_('Slides'), ordering='slide_count')
    def slide_count(self, obj):
        return obj.slide_count

    @admin.display(description=_('Unique viewers'), ordering='unique_viewers')
    def unique_viewers_display(self, obj):
        return _number(obj.unique_viewers)

    @admin.display(description=_('Comments'), ordering='comment_count')
    def comment_count_display(self, obj):
        return format_html('<a href="{}">{}</a>', _comments_url(obj), _number(obj.comment_count))

    # ------------------------------------------------------------ change page blocks

    @admin.display(description=_('Latest comments'))
    def recent_comments_display(self, obj):
        if not obj or not obj.pk:
            return '-'
        return render_to_string('admin/radio_crestin/story/comments.html', {
            'comments': obj.comments.select_related('slide', 'profile', 'user')[:RECENT_COMMENTS],
            'visible': obj.comments.filter(is_hidden=False).count(),
            'hidden': obj.comments.filter(is_hidden=True).count(),
            'all_url': _comments_url(obj),
            'enabled': obj.comments_enabled,
        })

    @admin.display(description=_('Preview'))
    def preview_display(self, obj):
        """The slides as the app gets them from the API: media, duration and the call to action."""
        if not obj or not obj.pk:
            return '-'
        absolute_url = getattr(obj, '_absolute_url', None) or (lambda url: url)
        slides = [(slide, story_feed.serialize_slide(slide, absolute_url)) for slide in obj.slides.all()]
        return render_to_string('admin/radio_crestin/story/preview.html', {
            'story': obj,
            'author': story_feed.author_payload(obj, absolute_url),
            'slides': [{
                'slide': slide, 'item': item,
                'cta_color': _css_color(item and item['cta'] and item['cta']['color']),
                'cta_text_color': _css_color(item and item['cta'] and item['cta']['text_color']),
            } for slide, item in slides],
        })

    @admin.display(description=_('Links'))
    def links_display(self, obj):
        if not obj or not obj.pk:
            return '-'
        token = AnnouncementSettings.load().preview_token
        api_preview = reverse('api_v1_story_detail', args=(obj.slug,)) + f'?preview={token}'
        return format_html(
            '<div>{} <a href="{}" target="_blank" rel="noopener">{}</a></div>'
            '<div>{} <a href="{}" target="_blank" rel="noopener">{}</a></div>',
            _('Share link:'), story_feed.share_url(obj.slug), story_feed.share_url(obj.slug),
            _('What the app gets (also in Preview status):'), api_preview, _('API preview'),
        )

    @admin.display(description=_('Stats'))
    def stats_display(self, obj):
        if not obj or not obj.pk:
            return '-'
        return render_to_string('admin/radio_crestin/story/stats.html', story_stats.summary(obj))

    # ------------------------------------------------------------ actions

    @unfold.decorators.action(description=_('Fetch YouTube and Instagram details again'), permissions=['change'])
    def refresh_embeds(self, request, object_id):
        story = get_object_or_404(Story, pk=object_id)
        self._report_refresh(request, story_embeds.refresh(StorySlide.objects.filter(story=story)))
        return redirect(reverse('admin:radio_crestin_story_change', args=(object_id,)))

    @admin.action(description=_('Fetch YouTube and Instagram details again'), permissions=['change'])
    def refresh_embeds_action(self, request, queryset):
        self._report_refresh(request, story_embeds.refresh(StorySlide.objects.filter(story__in=queryset)))

    def _report_refresh(self, request, refreshed):
        self.message_user(request, _('%(count)s slides updated.') % {'count': refreshed}, messages.SUCCESS)
        if not instagram_embeds.is_configured():
            self.message_user(request, _(
                'Instagram slides keep only their link until INSTAGRAM_OEMBED_TOKEN is set in the backend\'s '
                'environment.'), messages.WARNING)

    class Media:
        css = {'all': ('radio_crestin/stories/admin.css',)}
        js = ('radio_crestin/stories/slide_form.js',)


@admin.register(StorySettings, site=superapp_admin_site)
class StorySettingsAdmin(SuperAppModelAdmin):
    list_display = ['__str__', 'auto_open_gap_actions', 'comments_need_profile', 'stats_updated_until', 'updated_at']
    fields = ['auto_open_gap_actions', 'comments_need_profile', 'stats_updated_until', 'created_at', 'updated_at']
    readonly_fields = ['stats_updated_until', 'created_at', 'updated_at']

    def has_add_permission(self, request):
        return not StorySettings.objects.exists() and super().has_add_permission(request)

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(StoryComment, site=superapp_admin_site)
class StoryCommentAdmin(SuperAppModelAdmin):
    """Moderation of the public comments: hide (kept, seen by no listener), show again, or delete."""

    list_display = ['text_display', 'profile', 'story', 'slide_number', 'created_at', 'is_hidden',
                    'platform', 'user']
    list_filter = ['is_hidden', 'story', 'platform']
    search_fields = ['text', 'profile__name', 'user__anonymous_id', 'story__title', 'story__slug']
    date_hierarchy = 'created_at'
    list_select_related = ['story', 'slide', 'profile', 'user']
    fields = ['is_hidden', 'story', 'slide', 'profile', 'user', 'text', 'created_at', 'platform', 'app_version',
              'locale', 'country', 'ip']
    readonly_fields = [field for field in fields if field != 'is_hidden']
    actions = ['hide_action', 'show_action']

    @admin.display(description=_('Comment'))
    def text_display(self, obj):
        return obj.text if len(obj.text) <= 120 else obj.text[:119] + '…'

    @admin.display(description=_('Slide'))
    def slide_number(self, obj):
        return obj.slide.position + 1 if obj.slide else '-'

    @admin.action(description=_('Hide from listeners'), permissions=['change'])
    def hide_action(self, request, queryset):
        count = queryset.update(is_hidden=True)
        self.message_user(request, _('%(count)s comments hidden.') % {'count': count}, messages.SUCCESS)

    @admin.action(description=_('Show to listeners again'), permissions=['change'])
    def show_action(self, request, queryset):
        count = queryset.update(is_hidden=False)
        self.message_user(request, _('%(count)s comments shown again.') % {'count': count}, messages.SUCCESS)

    def has_add_permission(self, request):
        return False
