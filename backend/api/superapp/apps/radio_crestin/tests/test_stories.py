"""Stories: the API shape (backend/docs/stories-api.md), scheduling windows, targeting, CTAs, likes and views."""
import shutil
import subprocess
import tempfile
import unittest
from datetime import timedelta
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from ..forms.story_admin import StoryAdminForm, StorySlideForm
from ..models import (
    Announcement, AnnouncementSettings, Artists, Form, Songs, Story, StoryEvent, StoryLike, StorySettings, StorySlide,
    StoryStatBucket,
)
from ..models.announcement_validators import validate_app_url
from ..services import instagram_embeds, story_stat_buckets, youtube_embeds
from .helpers import make_station

LOCMEM_CACHE = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
LIST_URL = '/api/v1/stories/'
EVENTS_URL = '/api/v1/stories/events/'
PNG = (b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89'
       b'\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82')
EXPECTED_FILTERS_KEYS = {'platforms', 'countries_include', 'countries_exclude', 'locales',
                         'min_app_version', 'max_app_version'}
EXPECTED_SLIDE_KEYS = {'id', 'type', 'media_url', 'poster_url', 'duration_seconds', 'orientation', 'has_sound',
                       'youtube_url', 'instagram', 'cta'}
FILE_FIELDS = [(Story, 'cover_image'), (StorySlide, 'image'), (StorySlide, 'video'), (StorySlide, 'poster')]
NO_YOUTUBE = patch.object(youtube_embeds, 'fetch_details', return_value={})


def make_story(slug, slides=1, **fields):
    defaults = {'title': slug.title(), 'status': 'active', 'starts_at': timezone.now() - timedelta(hours=1)}
    defaults.update(fields)
    story = Story.objects.create(slug=slug, **defaults)
    for position in range(slides):
        StorySlide.objects.create(
            story=story, position=position, type='image', image=SimpleUploadedFile(f'{slug}-{position}.png', PNG),
            media_width=1080, media_height=1920,
        )
    return story


class TemporaryMediaMixin:
    """Uploads go to a temporary folder instead of media/public."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._media = tempfile.mkdtemp()
        cls._storages = []
        for model, name in FILE_FIELDS:
            field = model._meta.get_field(name)
            cls._storages.append((field, field.storage))
            field.storage = FileSystemStorage(location=cls._media, base_url='/media/public/')

    @classmethod
    def tearDownClass(cls):
        for field, storage in cls._storages:
            field.storage = storage
        shutil.rmtree(cls._media, ignore_errors=True)
        super().tearDownClass()


def stories(response):
    return response.json()['stories']


@override_settings(CACHES=LOCMEM_CACHE)
class StoryApiShapeTests(TemporaryMediaMixin, TestCase):
    def setUp(self):
        cache.clear()
        NO_YOUTUBE.start()
        self.addCleanup(NO_YOUTUBE.stop)

    def test_list_has_settings_and_the_story_shape(self):
        StorySettings.objects.create(auto_open_gap_actions=12)
        make_story('concert', auto_open=True, every_days=3, max_shows=5, platforms=['android'],
                   min_app_version='1.9.0', ends_at=timezone.now() + timedelta(days=2))

        body = self.client.get(LIST_URL).json()

        self.assertEqual(body['settings'], {'auto_open_gap_actions': 12})
        story = body['stories'][0]
        self.assertEqual(story['slug'], 'concert')
        self.assertEqual(story['share_url'], 'https://www.radiocrestin.ro/poveste/concert/')
        self.assertEqual(story['like_count'], 0)
        self.assertEqual(story['display'], {'auto_open': True, 'every_days': 3, 'every_actions': None, 'max_shows': 5})
        self.assertEqual(set(story['filters']), EXPECTED_FILTERS_KEYS)
        self.assertEqual(story['filters']['platforms'], ['android'])
        self.assertEqual(story['filters']['min_app_version'], '1.9.0')
        self.assertTrue(story['starts_at'].endswith('Z'))
        self.assertTrue(story['ends_at'].endswith('Z'))
        slide = story['slides'][0]
        self.assertTrue(EXPECTED_SLIDE_KEYS <= set(slide))
        self.assertEqual(slide['type'], 'image')
        self.assertTrue(slide['media_url'].startswith('http://testserver/media/public/stories/slides/'))
        self.assertEqual((slide['duration_seconds'], slide['orientation'], slide['has_sound']), (6, 'landscape', False))
        self.assertEqual((slide['width'], slide['height']), (1080, 1920))
        self.assertIsNone(slide['cta'])
        self.assertEqual(story['cover_url'], slide['media_url'])  # no cover: the first slide's picture

    def test_youtube_and_instagram_slides(self):
        story = make_story('media', slides=0)
        youtube = StorySlide.objects.create(story=story, position=0, type='youtube',
                                            youtube_url='https://youtu.be/dQw4w9WgXcQ')
        instagram = StorySlide.objects.create(story=story, position=1, type='instagram',
                                              instagram_url='https://www.instagram.com/radiocrestin/reel/C1a2B3c4D5e/?igsh=x')
        instagram.full_clean()  # canonicalizes the link, like the admin

        slides = stories(self.client.get(LIST_URL))[0]['slides']

        self.assertEqual(slides[0]['youtube_url'], 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
        self.assertEqual(slides[0]['poster_url'], 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
        self.assertEqual(slides[0]['youtube']['kind'], 'video')
        self.assertEqual((slides[0]['media_url'], slides[0]['has_sound'], slides[0]['duration_seconds']),
                         (None, True, 15))
        self.assertEqual(slides[1]['instagram'], {
            'url': 'https://www.instagram.com/reel/C1a2B3c4D5e/', 'kind': 'reel', 'thumbnail_url': None,
            'author_name': None, 'caption': None, 'media_url': None, 'media_type': None, 'shortcode': 'C1a2B3c4D5e',
            'embed_url': 'https://www.instagram.com/reel/C1a2B3c4D5e/embed/', 'author_url': None,
        })
        self.assertEqual(slides[1]['id'], instagram.pk)
        self.assertEqual(youtube.embed_details, {'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})

    def test_a_slide_without_its_media_is_left_out_and_a_story_without_slides_too(self):
        story = make_story('partial', slides=1)
        StorySlide.objects.create(story=story, position=5, type='video')
        make_story('empty', slides=0)

        listed = stories(self.client.get(LIST_URL))

        self.assertEqual([item['slug'] for item in listed], ['partial'])
        self.assertEqual(len(listed[0]['slides']), 1)

    def test_cta_targets(self):
        station = make_station('radio-vocea')
        song = Songs.objects.create(name='Har', artist=Artists.objects.create(name='Grup'))
        announcement = Announcement.objects.create(slug='concert', title='Concert')
        other = make_story('other')
        story = make_story('ctas', slides=0)
        base = {'story': story, 'type': 'youtube', 'youtube_url': 'https://youtu.be/dQw4w9WgXcQ', 'cta_label': 'Go'}
        slides = [
            StorySlide(cta_style='button', cta_target='url', cta_url='https://example.com/a', cta_open_in='browser'),
            StorySlide(cta_style='swipe_up', cta_target='app_link', cta_app='spotify', cta_app_url='spotify:track:1',
                       cta_fallback_url='https://open.spotify.com/track/1'),
            StorySlide(cta_style='both', cta_target='in_app', cta_route='station', cta_station=station),
            StorySlide(cta_style='button', cta_target='in_app', cta_route='song', cta_song=song),
            StorySlide(cta_style='button', cta_target='in_app', cta_route='announcement', cta_announcement=announcement),
            StorySlide(cta_style='button', cta_target='in_app', cta_route='settings'),
            StorySlide(cta_style='button', cta_target='story', cta_story=other),
        ]
        for position, slide in enumerate(slides):
            for key, value in base.items():
                setattr(slide, key, value)
            slide.position = position
            slide.save()

        ctas = [slide['cta'] for slide in self.client.get('/api/v1/stories/ctas/').json()['slides']]

        self.assertEqual(ctas[0], {'style': 'button', 'label': 'Go', 'color': None, 'text_color': None, 'target': {
            'type': 'url', 'url': 'https://example.com/a', 'open_in': 'browser'}})
        self.assertEqual(ctas[1]['target'], {'type': 'app_link', 'app': 'spotify', 'app_url': 'spotify:track:1',
                                             'fallback_url': 'https://open.spotify.com/track/1'})
        self.assertEqual(ctas[2], {'style': 'both', 'label': 'Go', 'color': None, 'text_color': None, 'target': {
            'type': 'in_app', 'route': 'station', 'slug': 'radio-vocea'}})
        self.assertEqual(ctas[3]['target'], {
            'type': 'in_app', 'route': 'song', 'slug': str(song.pk),
            'song': {'id': song.pk, 'name': 'Har', 'artist': 'Grup'},
            'fallback_url': 'https://www.youtube.com/results?search_query=Grup+Har'})
        self.assertEqual(ctas[4]['target'], {'type': 'in_app', 'route': 'announcement', 'slug': 'concert'})
        self.assertEqual(ctas[5]['target'], {'type': 'in_app', 'route': 'settings'})
        self.assertEqual(ctas[6]['target'], {'type': 'story', 'story_slug': 'other'})

    def test_a_cta_whose_target_was_deleted_is_hidden(self):
        station = make_station('gone')
        story = make_story('dangling', slides=0)
        StorySlide.objects.create(story=story, type='youtube', youtube_url='https://youtu.be/dQw4w9WgXcQ',
                                  cta_style='button', cta_label='Play', cta_target='in_app', cta_route='station',
                                  cta_station=station)
        station.delete()

        self.assertIsNone(self.client.get('/api/v1/stories/dangling/').json()['slides'][0]['cta'])


@override_settings(CACHES=LOCMEM_CACHE)
class StorySchedulingTests(TemporaryMediaMixin, TestCase):
    def setUp(self):
        cache.clear()

    def slugs(self, url=LIST_URL):
        return [item['slug'] for item in stories(self.client.get(url))]

    def test_only_active_stories_inside_the_window_are_listed(self):
        now = timezone.now()
        make_story('live')
        make_story('draft', status='draft')
        make_story('preview', status='preview')
        make_story('ended', ends_at=now - timedelta(minutes=1))
        make_story('soon', starts_at=now + timedelta(days=2))
        make_story('later', starts_at=now + timedelta(days=8))

        self.assertEqual(self.slugs(), ['live', 'soon'])

    def test_the_list_follows_the_drag_order(self):
        first, second = make_story('first'), make_story('second')
        Story.objects.filter(pk=first.pk).update(position=9)
        cache.clear()

        self.assertEqual(self.slugs(), ['second', 'first'])

    def test_one_story_only_inside_its_window(self):
        make_story('live')
        make_story('soon', starts_at=timezone.now() + timedelta(hours=1))

        self.assertEqual(self.client.get('/api/v1/stories/live/').json()['slug'], 'live')
        self.assertEqual(self.client.get('/api/v1/stories/soon/').status_code, 404)
        self.assertEqual(self.client.get('/api/v1/stories/missing/').status_code, 404)

    def test_preview_token_shows_preview_stories_uncached(self):
        make_story('live')
        make_story('preview', status='preview')
        token = AnnouncementSettings.load().preview_token

        self.assertEqual(self.slugs(f'{LIST_URL}?preview={token}'), ['live', 'preview'])
        self.assertEqual(self.client.get(f'/api/v1/stories/preview/?preview={token}').json()['slug'], 'preview')
        self.assertEqual(self.client.get(f'{LIST_URL}?preview=wrong').status_code, 403)
        self.assertEqual(self.client.get(f'{LIST_URL}?preview={token}')['Cache-Control'], 'private, no-store')

    def test_etag_and_cache_drop_on_change(self):
        story = make_story('live')
        first = self.client.get(LIST_URL)
        self.assertEqual(self.client.get(LIST_URL, HTTP_IF_NONE_MATCH=first['ETag']).status_code, 304)

        story.title = 'Changed'
        story.save()
        second = self.client.get(LIST_URL)

        self.assertNotEqual(first['ETag'], second['ETag'])
        self.assertEqual(stories(second)[0]['title'], 'Changed')

    def test_story_end_must_follow_its_start(self):
        story = Story(slug='bad', title='Bad', starts_at=timezone.now(), ends_at=timezone.now() - timedelta(hours=1))
        with self.assertRaises(ValidationError) as raised:
            story.full_clean()
        self.assertIn('ends_at', raised.exception.message_dict)


@override_settings(CACHES=LOCMEM_CACHE)
class StoryTargetingFormTests(TestCase):
    def form(self, **overrides):
        data = {'slug': 'concert', 'title': 'Concert', 'status': 'active', 'starts_at': '2026-12-01 10:00:00'}
        data.update(overrides)
        form = StoryAdminForm(data=data)
        form.is_valid()
        return form

    def test_filters_are_cleaned_like_the_announcements(self):
        form = self.form(platforms=['android', 'ios'], countries_include='ro, md', locales='ro\nhu',
                         min_app_version='1.9.0', every_days='3', every_actions='10', max_shows='5')
        self.assertEqual(form.errors, {})
        self.assertEqual(form.cleaned_data['countries_include'], ['RO', 'MD'])
        self.assertEqual(form.cleaned_data['platforms'], ['android', 'ios'])

    def test_invalid_filters_and_reserved_slugs_are_refused(self):
        self.assertIn('countries_include', self.form(countries_include='Romania').errors)
        self.assertIn('platforms', self.form(platforms=['tv']).errors)
        self.assertIn('slug', self.form(slug='liked').errors)
        self.assertIn('slug', self.form(slug='Has Spaces').errors)
        self.assertIn('every_days', self.form(every_days='0').errors)


@override_settings(CACHES=LOCMEM_CACHE)
class StorySlideValidationTests(TemporaryMediaMixin, TestCase):
    def setUp(self):
        self.story = make_story('concert', slides=0)

    def errors(self, **fields):
        slide = StorySlide(story=self.story, **fields)
        try:
            slide.full_clean()
        except ValidationError as error:
            return error.message_dict
        return {}

    def test_each_type_needs_its_media(self):
        self.assertIn('image', self.errors(type='image'))
        self.assertIn('video', self.errors(type='video'))
        self.assertIn('youtube_url', self.errors(type='youtube', youtube_url='https://vimeo.com/1'))
        self.assertIn('instagram_url', self.errors(type='instagram', instagram_url='https://www.instagram.com/radiocrestin/'))
        self.assertEqual(self.errors(type='instagram', instagram_url='https://instagram.com/p/C1a2B3c4D5e'), {})

    def test_cta_needs_a_label_and_its_target(self):
        youtube = {'type': 'youtube', 'youtube_url': 'https://youtu.be/dQw4w9WgXcQ'}
        self.assertIn('cta_label', self.errors(**youtube, cta_style='button', cta_target='url', cta_url='https://a.ro'))
        self.assertIn('cta_url', self.errors(**youtube, cta_style='button', cta_label='Go', cta_target='url'))
        app = self.errors(**youtube, cta_style='swipe_up', cta_label='Go', cta_target='app_link',
                          cta_app_url='spotify:track:1')
        self.assertIn('cta_fallback_url', app)
        self.assertIn('cta_station', self.errors(**youtube, cta_style='both', cta_label='Go', cta_target='in_app',
                                                 cta_route='station'))
        self.assertIn('cta_story', self.errors(**youtube, cta_style='button', cta_label='Go', cta_target='story',
                                               cta_story=self.story))
        self.assertEqual(self.errors(**youtube, cta_style='button', cta_label='Go', cta_target='in_app',
                                     cta_route='settings'), {})

    def test_app_links_refuse_unsafe_schemes(self):
        for good in ('https://youtu.be/dQw4w9WgXcQ', 'spotify:track:4uLU6hMCjMI75M1A2tKUQC', 'fb://page/123',
                     'instagram://user?username=radiocrestin'):
            validate_app_url(good)
        for bad in ('javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'intent://x#Intent;end',
                    'JavaScript:alert(1)', 'http://', 'not a link', 'spotify:track: 1'):
            with self.assertRaises(ValidationError, msg=bad):
                validate_app_url(bad)


@override_settings(CACHES=LOCMEM_CACHE)
@unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'needs ffmpeg and ffprobe')
class StoryVideoUploadTests(TemporaryMediaMixin, TestCase):
    def setUp(self):
        self.story = make_story('teaser', slides=0)

    def video(self, seconds, sound=True):
        path = tempfile.mktemp(suffix='.mp4', dir=self._media)
        inputs = ['-f', 'lavfi', '-i', f'testsrc=size=160x90:rate=10:duration={seconds}']
        if sound:
            inputs += ['-f', 'lavfi', '-i', f'sine=duration={seconds}']
        subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-pix_fmt', 'yuv420p', '-shortest', path], check=True)
        with open(path, 'rb') as handle:
            return SimpleUploadedFile('teaser.mp4', handle.read(), content_type='video/mp4')

    def form(self, upload):
        return StorySlideForm(
            data={'story': self.story.pk, 'position': 0, 'type': 'video', 'orientation': 'landscape',
                  'cta_style': 'swipe_up', 'cta_label': 'Watch it all', 'cta_target': 'url',
                  'cta_url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'cta_open_in': 'in_app_browser',
                  'cta_app': 'youtube', 'cta_route': 'station'},
            files={'video': upload}, instance=StorySlide(story=self.story),
        )

    def test_a_short_video_is_measured_and_gets_a_poster(self):
        form = self.form(self.video(3))
        self.assertTrue(form.is_valid(), form.errors)
        slide = form.save()

        self.assertAlmostEqual(slide.video_seconds, 3, delta=0.2)
        self.assertTrue(slide.has_sound)
        self.assertEqual((slide.media_width, slide.media_height), (160, 90))
        self.assertTrue(slide.poster.name.startswith('stories/posters/'))
        item = self.client.get('/api/v1/stories/teaser/').json()['slides'][0]
        self.assertEqual(item['duration_seconds'], round(slide.video_seconds, 1))
        self.assertTrue(item['poster_url'].endswith('.jpg'))
        self.assertEqual((item['mime_type'], item['has_sound']), ('video/mp4', True))
        self.assertEqual(item['cta']['style'], 'swipe_up')

    def test_a_video_over_a_minute_is_refused(self):
        form = self.form(self.video(62, sound=False))
        self.assertFalse(form.is_valid())
        self.assertIn('at most 60', form.errors['video'][0])

    def test_a_file_that_is_not_a_video_is_refused(self):
        form = self.form(SimpleUploadedFile('fake.mp4', b'not a video', content_type='video/mp4'))
        self.assertFalse(form.is_valid())
        self.assertIn('could not be read', form.errors['video'][0])


@override_settings(CACHES=LOCMEM_CACHE)
class StoryEventsTests(TemporaryMediaMixin, TestCase):
    def setUp(self):
        cache.clear()
        self.story = make_story('concert', slides=2)
        self.slides = list(self.story.slides.order_by('position'))

    def post(self, events, device_id='phone-1', **extra):
        payload = {'device_id': device_id, 'platform': 'android', 'app_version': '1.9.0', 'events': events, **extra}
        return self.client.post(EVENTS_URL, payload, content_type='application/json').json()

    def test_like_is_once_per_device_and_unlike_takes_it_back(self):
        first = self.post([{'type': 'like', 'story': 'concert'}])
        again = self.post([{'type': 'like', 'story': 'concert'}])
        other = self.post([{'type': 'like', 'story': 'concert'}], device_id='phone-2')

        self.assertEqual((first['accepted'], first['like_counts'], first['liked']), (1, {'concert': 1}, ['concert']))
        self.assertEqual((again['accepted'], again['like_counts']), (0, {'concert': 1}))
        self.assertEqual(other['like_counts'], {'concert': 2})

        unliked = self.post([{'type': 'unlike', 'story': 'concert'}])
        self.assertEqual((unliked['like_counts'], unliked['liked']), ({'concert': 1}, []))
        self.assertEqual(self.post([{'type': 'unlike', 'story': 'concert'}])['accepted'], 0)
        self.story.refresh_from_db()
        self.assertEqual(self.story.like_count, 1)
        self.assertEqual(StoryLike.objects.get().device_id, 'phone-2')

    def test_likes_need_a_device_id(self):
        result = self.post([{'type': 'like', 'story': 'concert'}], device_id='')
        self.assertEqual((result['accepted'], result['like_counts']), (0, {'concert': 0}))

    def test_views_are_counted_once_per_device_in_their_window(self):
        events = [{'type': 'view', 'story': 'concert'}, {'type': 'auto_open', 'story': 'concert'},
                  {'type': 'slide_view', 'story': 'concert', 'slide': self.slides[0].pk},
                  {'type': 'slide_view', 'story': 'concert', 'slide': self.slides[1].pk},
                  {'type': 'cta_click', 'story': 'concert', 'slide': self.slides[1].pk, 'target': 'swipe_up'},
                  {'type': 'complete', 'story': 'concert'}, {'type': 'share', 'story': 'concert'}]
        self.assertEqual(self.post(events)['accepted'], 7)
        self.assertEqual(self.post(events)['accepted'], 0)
        self.assertEqual(self.post(events, device_id='phone-2')['accepted'], 7)

        self.story.refresh_from_db()
        self.assertEqual((self.story.views, self.story.auto_opens, self.story.slide_views, self.story.cta_clicks,
                          self.story.completions, self.story.shares), (2, 2, 4, 2, 2, 2))
        self.slides[1].refresh_from_db()
        self.assertEqual((self.slides[1].views, self.slides[1].cta_clicks), (2, 2))
        self.assertEqual(StoryEvent.objects.filter(type='cta_click').first().target, 'swipe_up')

    def test_unknown_stories_types_and_other_stories_slides_are_skipped(self):
        other = make_story('other', slides=1)
        result = self.post([
            {'type': 'view', 'story': 'missing'},
            {'type': 'dance', 'story': 'concert'},
            {'type': 'slide_view', 'story': 'concert', 'slide': other.slides.get().pk},
            {'type': 'slide_view', 'story': 'concert'},
            {'type': 'view', 'story': 'concert', 'at': (timezone.now() - timedelta(days=2)).isoformat()},
        ])
        self.assertEqual(result['accepted'], 0)
        self.assertEqual(self.client.post(EVENTS_URL, 'nope', content_type='text/plain').status_code, 400)

    def test_liked_endpoint_lists_the_device_likes(self):
        make_story('other')
        self.post([{'type': 'like', 'story': 'other'}, {'type': 'like', 'story': 'concert'}])

        self.assertEqual(self.client.get('/api/v1/stories/liked/?device_id=phone-1').json(),
                         {'liked': ['concert', 'other']})
        self.assertEqual(self.client.get('/api/v1/stories/liked/').json(), {'liked': []})

    def test_daily_buckets_count_views_likes_and_unique_viewers(self):
        self.post([{'type': 'view', 'story': 'concert'}, {'type': 'like', 'story': 'concert'}])
        self.post([{'type': 'view', 'story': 'concert'}, {'type': 'unlike', 'story': 'concert'}], device_id='phone-2')
        self.post([{'type': 'auto_open', 'story': 'concert'}], device_id='phone-2')

        story_stat_buckets.upsert_recent()
        bucket = StoryStatBucket.objects.get(story=self.story)

        self.assertEqual((bucket.views, bucket.auto_opens, bucket.likes, bucket.unlikes, bucket.unique_viewers),
                         (2, 1, 1, 0, 2))
        self.assertIsNotNone(StorySettings.load().stats_updated_until)
        story_stat_buckets.upsert_recent()  # a repeated run gives the same row
        self.assertEqual(StoryStatBucket.objects.get(story=self.story).views, 2)


@override_settings(CACHES=LOCMEM_CACHE)
class InstagramEmbedTests(TestCase):
    def test_parse_accepts_posts_and_reels_only(self):
        cases = {
            'https://www.instagram.com/p/C1a2B3c4D5e/': ('post', 'C1a2B3c4D5e'),
            'https://instagram.com/reel/C1a2B3c4D5e?igsh=abc': ('reel', 'C1a2B3c4D5e'),
            'https://www.instagram.com/reels/C1a2B3c4D5e/': ('reel', 'C1a2B3c4D5e'),
            'https://www.instagram.com/tv/C1a2B3c4D5e/': ('reel', 'C1a2B3c4D5e'),
            'https://www.instagram.com/radiocrestin/p/C1a2B3c4D5e/': ('post', 'C1a2B3c4D5e'),
        }
        for url, (kind, code) in cases.items():
            post = instagram_embeds.parse(url)
            self.assertEqual((post.kind, post.shortcode), (kind, code), url)
        for url in ('https://www.instagram.com/radiocrestin/', 'https://www.instagram.com/stories/x/123/',
                    'https://evil.com/p/C1a2B3c4D5e/', 'javascript:alert(1)', ''):
            self.assertIsNone(instagram_embeds.parse(url), url)

    @patch.dict('os.environ', {instagram_embeds.TOKEN_ENV: ''})
    def test_without_a_token_nothing_is_fetched(self):
        with patch('requests.get') as get:
            self.assertEqual(instagram_embeds.fetch_details(instagram_embeds.parse('https://instagram.com/p/C1a2B3c4D5e/')), {})
        get.assert_not_called()

    @patch.dict('os.environ', {instagram_embeds.TOKEN_ENV: 'app|token'})
    def test_with_a_token_the_oembed_is_fetched_and_cleaned(self):
        response = Mock()
        response.json.return_value = {
            'author_name': 'radiocrestin', 'thumbnail_url': 'https://scontent.cdninstagram.com/t.jpg',
            'thumbnail_width': 640, 'thumbnail_height': 1136, 'provider_name': 'Instagram',
            'html': '<blockquote><div><p><a href="x">Repetiții\n pentru concert</a></p>'
                    '<p>A post shared by Radio Crestin</p></div></blockquote><script>evil()</script>',
            'thumbnail_url_bad': 'javascript:x',
        }
        with patch('requests.get', return_value=response) as get:
            details = instagram_embeds.fetch_details(instagram_embeds.parse('https://instagram.com/p/C1a2B3c4D5e/'))

        self.assertEqual(get.call_args.kwargs['params']['url'], 'https://www.instagram.com/p/C1a2B3c4D5e/')
        self.assertEqual(details['author_name'], 'radiocrestin')
        self.assertEqual(details['caption'], 'Repetiții pentru concert')
        self.assertEqual(details['thumbnail_url'], 'https://scontent.cdninstagram.com/t.jpg')
        self.assertNotIn('html', details)
        self.assertIn('fetched_at', details)


@override_settings(CACHES=LOCMEM_CACHE)
class InstagramSlideRefreshTests(TemporaryMediaMixin, TestCase):
    def test_saving_and_the_command_fetch_details_once_the_token_is_set(self):
        story = make_story('insta', slides=0)
        with patch.dict('os.environ', {instagram_embeds.TOKEN_ENV: ''}):
            slide = StorySlide.objects.create(story=story, type='instagram',
                                              instagram_url='https://www.instagram.com/p/C1a2B3c4D5e/')
        self.assertEqual(slide.embed_details, {'url': 'https://www.instagram.com/p/C1a2B3c4D5e/'})

        details = {'thumbnail_url': 'https://scontent.cdninstagram.com/t.jpg', 'author_name': 'radiocrestin'}
        with patch.dict('os.environ', {instagram_embeds.TOKEN_ENV: 'app|token'}), \
                patch.object(instagram_embeds, 'fetch_details', return_value=details):
            call_command('refresh_story_embeds', stdout=Mock())
        slide.refresh_from_db()

        self.assertEqual(slide.embed_details['author_name'], 'radiocrestin')
        item = self.client.get('/api/v1/stories/insta/').json()['slides'][0]
        self.assertEqual(item['poster_url'], 'https://scontent.cdninstagram.com/t.jpg')
        self.assertEqual(item['instagram']['thumbnail_url'], 'https://scontent.cdninstagram.com/t.jpg')


@override_settings(CACHES=LOCMEM_CACHE)
class StoryAdminTests(TemporaryMediaMixin, TestCase):
    def setUp(self):
        NO_YOUTUBE.start()
        self.addCleanup(NO_YOUTUBE.stop)
        self.client.force_login(get_user_model().objects.create_superuser(email='admin@example.com', password='x'))
        self.story = make_story('concert', slides=1)
        StorySlide.objects.create(story=self.story, position=1, type='youtube',
                                  youtube_url='https://youtu.be/dQw4w9WgXcQ', cta_style='both',
                                  cta_label='Watch it all', cta_target='url', cta_url='https://example.com/full')

    def test_list_add_and_change_pages_render_with_the_preview(self):
        self.assertEqual(self.client.get(reverse('admin:radio_crestin_story_changelist')).status_code, 200)
        self.assertEqual(self.client.get(reverse('admin:radio_crestin_story_add')).status_code, 200)
        response = self.client.get(reverse('admin:radio_crestin_story_change', args=(self.story.pk,)))

        self.assertEqual(response.status_code, 200)
        page = response.content.decode()
        self.assertIn('story-preview__slide', page)
        self.assertIn('Watch it all', page)
        self.assertIn('story-preview__swipe', page)
        self.assertIn('https://www.radiocrestin.ro/poveste/concert/', page)

    def test_adding_a_story_with_a_slide_through_the_admin(self):
        data = {
            'title': 'New', 'slug': 'new', 'status': 'draft', 'starts_at_0': '2026-12-01', 'starts_at_1': '10:00:00',
            'slides-TOTAL_FORMS': '1', 'slides-INITIAL_FORMS': '0', 'slides-MIN_NUM_FORMS': '1',
            'slides-MAX_NUM_FORMS': '1000',
            'slides-0-position': '0', 'slides-0-type': 'youtube', 'slides-0-orientation': 'landscape',
            'slides-0-youtube_url': 'https://www.youtube.com/shorts/aBcDeFgHiJk',
            'slides-0-cta_style': 'button', 'slides-0-cta_label': 'Open', 'slides-0-cta_target': 'in_app',
            'slides-0-cta_route': 'settings', 'slides-0-cta_open_in': 'in_app_browser', 'slides-0-cta_app': 'youtube',
        }
        response = self.client.post(reverse('admin:radio_crestin_story_add'), data)

        self.assertEqual(response.status_code, 302, response.content.decode()[:3000])
        slide = Story.objects.get(slug='new').slides.get()
        self.assertEqual(slide.youtube_url, 'https://www.youtube.com/shorts/aBcDeFgHiJk')

    def test_settings_admin_is_a_single_row(self):
        settings = StorySettings.load()
        response = self.client.get(reverse('admin:radio_crestin_storysettings_change', args=(settings.pk,)))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get(reverse('admin:radio_crestin_storysettings_add')).status_code, 403)

    def test_form_and_announcement_targets_are_searchable(self):
        Form.objects.create(slug='poll', title='Poll')
        for model in ('form', 'announcement', 'songs', 'story'):
            response = self.client.get(reverse('admin:autocomplete'), {
                'app_label': 'radio_crestin', 'model_name': 'storyslide', 'field_name': f'cta_{model.rstrip("s")}',
                'term': 'p',
            })
            self.assertEqual(response.status_code, 200, model)
