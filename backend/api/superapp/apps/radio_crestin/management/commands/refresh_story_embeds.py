"""Fetches the YouTube and Instagram details of story slides again.

Run it after setting INSTAGRAM_OEMBED_TOKEN, so the Instagram slides saved before get their
picture, author and caption: python manage.py refresh_story_embeds [--all]
"""
from django.core.management.base import BaseCommand

from ...models import SlideType, StorySlide
from ...services import instagram_embeds, story_embeds


class Command(BaseCommand):
    help = 'Fetches the YouTube and Instagram details of story slides again.'

    def add_arguments(self, parser):
        parser.add_argument('--all', action='store_true', help='YouTube slides too (default: Instagram only).')

    def handle(self, *args, **options):
        types = [SlideType.INSTAGRAM, SlideType.YOUTUBE] if options['all'] else [SlideType.INSTAGRAM]
        if SlideType.INSTAGRAM in types and not instagram_embeds.is_configured():
            self.stdout.write(self.style.WARNING(
                f'{instagram_embeds.TOKEN_ENV} is not set: Instagram slides keep only their link.'))
        refreshed = story_embeds.refresh(StorySlide.objects.filter(type__in=types))
        self.stdout.write(self.style.SUCCESS(f'{refreshed} slides updated.'))
