"""Story messages, author, captions and CTA colours (backend/docs/stories-api.md), and fresh like counts."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from ..models import StoryMessage, StorySlide
from .test_stories import LIST_URL, LOCMEM_CACHE, NO_YOUTUBE, PNG, TemporaryMediaMixin, make_story

MESSAGES_URL = '/api/v1/stories/messages/'
EVENTS_URL = '/api/v1/stories/events/'


@override_settings(CACHES=LOCMEM_CACHE)
class StoryNewKeysTests(TemporaryMediaMixin, TestCase):
    def setUp(self):
        cache.clear()

    def test_new_keys_default_to_null(self):
        make_story('plain')

        story = self.client.get(LIST_URL).json()['stories'][0]

        self.assertEqual(story['messages'], {'enabled': False, 'placeholder': None})
        self.assertIsNone(story['author'])
        self.assertIsNone(story['slides'][0]['caption'])

    def test_messages_author_caption_and_cta_colours(self):
        story = make_story('reel', messages_enabled=True, messages_placeholder='  Scrie-ne o cerere de rugăciune ',
                           author_name='Radio Vocea Evangheliei',
                           author_avatar=SimpleUploadedFile('vocea.png', PNG))
        StorySlide.objects.filter(story=story).update(
            caption=' Concert de Crăciun\nla Arad ', cta_style='button', cta_label='Bilete', cta_target='url',
            cta_url='https://example.com/bilete', cta_color='#ffc107', cta_text_color='#000000')
        StorySlide.objects.create(story=story, position=1, type='youtube', youtube_url='https://youtu.be/dQw4w9WgXcQ',
                                  cta_style='button', cta_label='Vezi', cta_target='url',
                                  cta_url='https://example.com/v')

        with NO_YOUTUBE:
            body = self.client.get('/api/v1/stories/reel/').json()

        self.assertEqual(body['messages'], {'enabled': True, 'placeholder': 'Scrie-ne o cerere de rugăciune'})
        self.assertEqual(body['author']['name'], 'Radio Vocea Evangheliei')
        self.assertTrue(body['author']['avatar_url'].startswith('http://testserver/media/public/stories/authors/'))
        first, second = body['slides']
        self.assertEqual(first['caption'], 'Concert de Crăciun\nla Arad')
        self.assertEqual((first['cta']['color'], first['cta']['text_color']), ('#FFC107', '#000000'))
        self.assertEqual((second['cta']['color'], second['cta']['text_color']), (None, None))
        self.assertIsNone(second['caption'])

    def test_author_without_avatar(self):
        make_story('named', author_name='Ana')
        self.assertEqual(self.client.get(LIST_URL).json()['stories'][0]['author'], {'name': 'Ana', 'avatar_url': None})

    def test_colours_must_be_hex_and_an_avatar_needs_a_name(self):
        story = make_story('checks')
        slide = story.slides.get()
        slide.cta_color = 'red'
        with self.assertRaises(ValidationError) as raised:
            slide.full_clean()
        self.assertIn('cta_color', raised.exception.message_dict)

        story.author_avatar = SimpleUploadedFile('a.png', PNG)
        with self.assertRaises(ValidationError) as raised:
            story.full_clean()
        self.assertIn('author_name', raised.exception.message_dict)

    def test_like_count_in_the_cached_list_follows_new_likes(self):
        make_story('concert')
        detail = self.client.get('/api/v1/stories/concert/')
        first = self.client.get(LIST_URL)
        self.assertEqual(first.json()['stories'][0]['like_count'], 0)

        self.client.post(EVENTS_URL, {'device_id': 'phone-1', 'events': [{'type': 'like', 'story': 'concert'}]},
                         content_type='application/json')

        again = self.client.get(LIST_URL, HTTP_IF_NONE_MATCH=first['ETag'])
        self.assertEqual(again.status_code, 200)  # a new body, so a new ETag
        self.assertEqual(again.json()['stories'][0]['like_count'], 1)
        self.assertEqual(self.client.get('/api/v1/stories/concert/', HTTP_IF_NONE_MATCH=detail['ETag'])
                         .json()['like_count'], 1)  # one story too
        self.assertEqual(self.client.get(LIST_URL, HTTP_IF_NONE_MATCH=again['ETag']).status_code, 304)


@override_settings(CACHES=LOCMEM_CACHE)
class StoryMessagesEndpointTests(TemporaryMediaMixin, TestCase):
    def setUp(self):
        cache.clear()
        self.story = make_story('rugaciune', slides=2, messages_enabled=True)
        self.slide = self.story.slides.order_by('position').last()

    def post(self, device_id='phone-1', **fields):
        payload = {'device_id': device_id, 'platform': 'android', 'app_version': '1.9.0', 'locale': 'ro-RO',
                   'story': 'rugaciune', 'slide': self.slide.pk, 'text': 'Vă rog să vă rugați pentru mama.'}
        payload.update(fields)
        return self.client.post(MESSAGES_URL, payload, content_type='application/json')

    def test_a_valid_message_is_stored(self):
        response = self.post(text='  Vă rog să vă rugați pentru mama.\n ')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json(), {'status': 'ok'})
        self.assertEqual(response['Cache-Control'], 'private, no-store')
        message = StoryMessage.objects.get()
        self.assertEqual((message.story, message.slide, message.text),
                         (self.story, self.slide, 'Vă rog să vă rugați pentru mama.'))
        self.assertEqual((message.device_id, message.platform, message.app_version, message.locale),
                         ('phone-1', 'android', '1.9.0', 'ro-RO'))

    def test_slide_may_be_null_or_not_this_storys(self):
        other = make_story('alta')
        self.assertEqual(self.post(slide=None).status_code, 201)
        self.assertEqual(self.post(slide=other.slides.get().pk).status_code, 201)
        self.assertEqual(list(StoryMessage.objects.values_list('slide', flat=True)), [None, None])

    def test_empty_or_too_long_text_is_refused(self):
        for number, text in enumerate(('', '   \n ', None, 42)):
            response = self.post(text=text, device_id=f'phone-{number}')
            self.assertEqual(response.status_code, 400, text)
            self.assertEqual(response.json(), {'error': 'text is empty'})
        self.assertEqual(self.post(text='ă' * 1000, device_id='phone-5').status_code, 201)
        too_long = self.post(text='a' * 1001, device_id='phone-6')
        self.assertEqual(too_long.status_code, 400)
        self.assertIn('1000', too_long.json()['error'])
        self.assertEqual(StoryMessage.objects.count(), 1)

    def test_a_story_that_does_not_take_messages_is_refused(self):
        make_story('fara', messages_enabled=False)
        make_story('ended', messages_enabled=True, ends_at=timezone.now() - timedelta(minutes=1),
                   starts_at=timezone.now() - timedelta(days=1))
        make_story('draft', messages_enabled=True, status='draft')
        for slug in ('fara', 'ended', 'draft', 'missing', None):
            response = self.post(story=slug)
            self.assertEqual(response.status_code, 400, slug)
            self.assertEqual(response.json(), {'error': 'this story does not take messages'})
        self.assertFalse(StoryMessage.objects.exists())

    def test_device_id_and_json_object_are_required(self):
        self.assertEqual(self.post(device_id='').status_code, 400)
        self.assertEqual(self.client.post(MESSAGES_URL, 'nope', content_type='application/json').status_code, 400)
        self.assertEqual(self.client.post(MESSAGES_URL, [1], content_type='application/json').status_code, 400)

    def test_five_a_minute_per_device(self):
        statuses = [self.post().status_code for _ in range(6)]

        self.assertEqual(statuses, [201] * 5 + [429])
        self.assertEqual(self.post(device_id='phone-2').status_code, 201)
        self.assertEqual(StoryMessage.objects.count(), 6)

    def test_get_is_not_allowed_and_options_answers_cors(self):
        self.assertEqual(self.client.get(MESSAGES_URL).status_code, 405)
        response = self.client.options(MESSAGES_URL)
        self.assertEqual(response['Access-Control-Allow-Methods'], 'POST, OPTIONS')


@override_settings(CACHES=LOCMEM_CACHE)
class StoryMessagesAdminTests(TemporaryMediaMixin, TestCase):
    def setUp(self):
        self.client.force_login(get_user_model().objects.create_superuser(email='admin@example.com', password='x'))
        self.story = make_story('rugaciune', messages_enabled=True, messages_placeholder='Scrie-ne',
                                author_name='Ana')
        StorySlide.objects.filter(story=self.story).update(caption='O seară de colinde', cta_style='button',
                                                           cta_label='Bilete', cta_target='url',
                                                           cta_url='https://example.com', cta_color='#FFC107')
        for number in range(3):
            StoryMessage.objects.create(story=self.story, slide=self.story.slides.get(), text=f'Mesajul {number}',
                                        platform='ios', device_id=f'phone-{number}')

    def test_story_list_counts_messages_and_links_to_them(self):
        page = self.client.get(reverse('admin:radio_crestin_story_changelist')).content.decode()
        self.assertIn(f'?story__id__exact={self.story.pk}', page)

        messages = self.client.get(reverse('admin:radio_crestin_storymessage_changelist'),
                                   {'story__id__exact': self.story.pk})
        self.assertEqual(messages.status_code, 200)
        self.assertIn('Mesajul 2', messages.content.decode())
        self.assertEqual(self.client.get(reverse('admin:radio_crestin_storymessage_add')).status_code, 403)

    def test_change_page_shows_messages_fields_and_the_preview(self):
        page = self.client.get(reverse('admin:radio_crestin_story_change', args=(self.story.pk,))).content.decode()

        for text in ('messages_enabled', 'messages_placeholder', 'author_name', 'author_avatar',
                     'slides-0-caption', 'slides-0-cta_color', 'slides-0-cta_text_color',
                     'Mesajul 0', 'O seară de colinde', 'background: #FFC107'):
            self.assertIn(text, page)

    def test_message_page_is_read_only(self):
        message = StoryMessage.objects.first()
        response = self.client.get(reverse('admin:radio_crestin_storymessage_change', args=(message.pk,)))
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('name="text"', response.content.decode())


class StoryMessagesMigrationTests(TestCase):
    """The data check of 0084 is in test_announcement_migrations (one migration test for the whole app)."""

    def test_models_match_the_migrations(self):
        call_command('makemigrations', 'radio_crestin', '--check', '--dry-run', verbosity=0)
