"""Keeps what clients see in step with the admin.

- Every change drops the cached stories API responses (services/story_feed).
- A YouTube or Instagram slide fetches its post's details when it is saved (services/story_embeds).
- A change to a story the website has a share page for schedules a website rebuild (services/web_deploy).
"""
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from ..models import Story, StorySettings, StorySlide, StoryStatus
from ..services import story_embeds, web_deploy
from ..services.story_feed import invalidate_cache


@receiver([post_save, post_delete], sender=Story)
@receiver([post_save, post_delete], sender=StorySlide)
@receiver([post_save, post_delete], sender=StorySettings)
def invalidate_stories_cache(sender, **kwargs):
    invalidate_cache()


@receiver(pre_save, sender=StorySlide)
def store_embed_details(sender, instance, update_fields=None, **kwargs):
    if update_fields is not None and 'embed_details' not in update_fields:
        return  # a partial save that doesn't write them
    instance.embed_details = story_embeds.details_for(instance)


@receiver(pre_save, sender=Story)
def remember_share_page(sender, instance, **kwargs):
    """Whether the stored version had a share page on the website, so hiding it also rebuilds."""
    previous = Story.objects.filter(pk=instance.pk).values_list('status', flat=True).first() if instance.pk else None
    instance._had_share_page = previous == StoryStatus.ACTIVE


@receiver(post_save, sender=Story)
def rebuild_website_on_save(sender, instance, **kwargs):
    if getattr(instance, '_had_share_page', False) or instance.status == StoryStatus.ACTIVE:
        web_deploy.schedule()


@receiver(post_delete, sender=Story)
def rebuild_website_on_delete(sender, instance, **kwargs):
    if instance.status == StoryStatus.ACTIVE:
        web_deploy.schedule()
