from django.contrib import admin
from django.db.models import Count
from django.urls import reverse
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _

from superapp.apps.admin_portal.admin import SuperAppModelAdmin
from superapp.apps.admin_portal.sites import superapp_admin_site
from ..models import Profile


@admin.register(Profile, site=superapp_admin_site)
class ProfileAdmin(SuperAppModelAdmin):
    """The public identities on stories and comments. Only the team creates them: there is no API for it."""

    list_display = ['name', 'avatar_display', 'app_user', 'comment_count', 'created_at']
    search_fields = ['name', 'app_user__anonymous_id', 'app_user__email']
    autocomplete_fields = ['app_user']
    fields = ['name', 'avatar', 'app_user', 'created_at', 'updated_at']
    readonly_fields = ['created_at', 'updated_at']
    list_select_related = ['app_user']

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(comment_total=Count('comments'))

    @admin.display(description=_('Avatar'))
    def avatar_display(self, obj):
        if not obj.avatar:
            return '-'
        return format_html('<img src="{}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover">',
                           obj.avatar.url)

    @admin.display(description=_('Comments'), ordering='comment_total')
    def comment_count(self, obj):
        url = reverse('admin:radio_crestin_storycomment_changelist') + f'?profile__id__exact={obj.pk}'
        return format_html('<a href="{}">{}</a>', url, obj.comment_total)
