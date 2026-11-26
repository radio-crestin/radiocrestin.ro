"""Story comments, author, captions and CTA colours (backend/docs/stories-api.md), and fresh counts in the list."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from ..models import StoryComment, StorySlide
from ..services import story_comments
from .test_stories import LIST_URL, LOCMEM_CACHE, NO_YOUTUBE, PNG, TemporaryMediaMixin, make_story

EVENTS_URL = '/api/v1/stories/events/'


def comments_url(slug='rugaciune', comment_id=None):
    return f'/api/v1/stories/{slug}/comments/' + (f'{comment_id}/' if comment_id else '')


@override_settings(CACHES=LOCMEM_CACHE)
class StoryNewKeysTests(TemporaryMediaMixin, TestCase):
    def setUp(self):
        cache.clear()

    def test_new_keys_default_to_off_and_null(self):
        make_story('plain')

        story = self.client.get(LIST_URL).json()['stories'][0]

        self.assertEqual(story['comments'], {'enabled': False, 'placeholder': None, 'count': 0})
        self.assertIsNone(story['author'])
        self.assertIsNone(story['slides'][0]['caption'])
        self.assertNotIn('messages', story)

    def test_comments_author_caption_and_cta_colours(self):
        story = make_story('reel', comments_enabled=True, comments_placeholder='  Scrie un gând ',
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

        self.assertEqual(body['comments'], {'enabled': True, 'placeholder': 'Scrie un gând', 'count': 0})
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

    def test_like_and_comment_counts_in_the_cached_list_stay_fresh(self):
        story = make_story('concert', comments_enabled=True)
        first = self.client.get(LIST_URL)
        detail = self.client.get('/api/v1/stories/concert/')
        self.assertEqual(first.json()['stories'][0]['like_count'], 0)

        self.client.post(EVENTS_URL, {'device_id': 'phone-1', 'events': [{'type': 'like', 'story': 'concert'}]},
                         content_type='application/json')
        StoryComment.objects.create(story=story, text='Amin', device_id='phone-1')
        StoryComment.objects.create(story=story, text='spam', device_id='phone-2', is_hidden=True)

        again = self.client.get(LIST_URL, HTTP_IF_NONE_MATCH=first['ETag'])
        self.assertEqual(again.status_code, 200)  # a new body, so a new ETag
        listed = again.json()['stories'][0]
        self.assertEqual((listed['like_count'], listed['comments']['count']), (1, 1))
        one = self.client.get('/api/v1/stories/concert/', HTTP_IF_NONE_MATCH=detail['ETag']).json()
        self.assertEqual((one['like_count'], one['comments']['count']), (1, 1))
        self.assertEqual(self.client.get(LIST_URL, HTTP_IF_NONE_MATCH=again['ETag']).status_code, 304)

    def test_comment_count_is_zero_while_comments_are_off(self):
        story = make_story('off')
        StoryComment.objects.create(story=story, text='Amin')
        self.assertEqual(self.client.get(LIST_URL).json()['stories'][0]['comments']['count'], 0)


@override_settings(CACHES=LOCMEM_CACHE)
class StoryCommentsEndpointTests(TemporaryMediaMixin, TestCase):
    def setUp(self):
        cache.clear()
        self.story = make_story('rugaciune', slides=2, comments_enabled=True)
        self.slide = self.story.slides.order_by('position').last()

    def post(self, device_id='phone-1', slug='rugaciune', **fields):
        payload = {'device_id': device_id, 'platform': 'android', 'app_version': '1.9.0', 'locale': 'ro-RO',
                   'slide': self.slide.pk, 'text': 'Doamne ajută!', 'author_name': 'Ana'}
        payload.update(fields)
        return self.client.post(comments_url(slug), payload, content_type='application/json')

    def get(self, slug='rugaciune', **params):
        return self.client.get(comments_url(slug), params)

    # ------------------------------------------------------------ POST

    def test_a_valid_comment_is_stored_and_returned_as_mine(self):
        response = self.post(text='  Doamne ajută!\n ')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response['Cache-Control'], 'private, no-store')
        comment = response.json()['comment']
        stored = StoryComment.objects.get()
        self.assertEqual(comment, {'id': stored.pk, 'author_name': 'Ana', 'text': 'Doamne ajută!',
                                   'created_at': comment['created_at'], 'mine': True})
        self.assertTrue(comment['created_at'].endswith('Z'))
        self.assertEqual((stored.story, stored.slide, stored.device_id, stored.platform, stored.locale),
                         (self.story, self.slide, 'phone-1', 'android', 'ro-RO'))
        self.assertNotIn('phone-1', response.content.decode())

    def test_html_is_stripped_and_no_name_is_shown_as_ascultator(self):
        response = self.post(text='<script>alert(1)</script><b>Amin</b>\x07', author_name='<i>  </i>')

        self.assertEqual(response.status_code, 201)
        comment = response.json()['comment']
        self.assertEqual((comment['text'], comment['author_name']), ('alert(1)Amin', 'Ascultător'))
        self.assertEqual(StoryComment.objects.get().author_name, '')
        self.assertEqual(self.post(author_name=None, device_id='phone-2').json()['comment']['author_name'],
                         'Ascultător')
        self.assertEqual(self.post(text='<p></p>', device_id='phone-3').json(), {'error': 'text is empty'})

    def test_slide_may_be_null_or_not_this_storys(self):
        other = make_story('alta')
        self.assertEqual(self.post(slide=None).status_code, 201)
        self.assertEqual(self.post(slide=other.slides.get().pk).status_code, 201)
        self.assertEqual(list(StoryComment.objects.values_list('slide', flat=True)), [None, None])

    def test_empty_or_too_long_text_or_name_is_refused(self):
        for number, text in enumerate(('', '   \n ', None, 42)):
            response = self.post(text=text, device_id=f'phone-{number}')
            self.assertEqual(response.status_code, 400, text)
            self.assertEqual(response.json(), {'error': 'text is empty'})
        self.assertEqual(self.post(text='ă' * 500, device_id='phone-5').status_code, 201)
        too_long = self.post(text='a' * 501, device_id='phone-6')
        self.assertEqual((too_long.status_code, too_long.json()), (400, {'error': 'text is longer than 500 characters'}))
        self.assertEqual(self.post(author_name='n' * 40, device_id='phone-7').status_code, 201)
        long_name = self.post(author_name='n' * 41, device_id='phone-8')
        self.assertEqual((long_name.status_code, long_name.json()),
                         (400, {'error': 'author_name is longer than 40 characters'}))
        self.assertEqual(StoryComment.objects.count(), 2)

    def test_comments_off_unknown_or_ended_story(self):
        make_story('fara')
        make_story('ended', comments_enabled=True, ends_at=timezone.now() - timedelta(minutes=1),
                   starts_at=timezone.now() - timedelta(days=1))
        make_story('draft', comments_enabled=True, status='draft')

        off = self.post(slug='fara')
        self.assertEqual((off.status_code, off.json()), (400, {'error': 'comments are off for this story'}))
        for slug in ('ended', 'draft', 'missing'):
            self.assertEqual(self.post(slug=slug).status_code, 404, slug)
            self.assertEqual(self.get(slug=slug).status_code, 404, slug)
        self.assertFalse(StoryComment.objects.exists())

    def test_device_id_and_json_object_are_required(self):
        self.assertEqual(self.post(device_id='').json(), {'error': 'device_id is required'})
        for body in ('nope', [1]):
            response = self.client.post(comments_url(), body, content_type='application/json')
            self.assertEqual(response.status_code, 400)

    def test_five_a_minute_per_device(self):
        statuses = [self.post().status_code for _ in range(6)]

        self.assertEqual(statuses, [201] * 5 + [429])
        self.assertEqual(self.post(device_id='phone-2').status_code, 201)
        self.assertEqual(StoryComment.objects.count(), 6)

    # ------------------------------------------------------------ GET

    def test_pages_newest_first_visible_only_with_mine(self):
        for number in range(65):
            StoryComment.objects.create(story=self.story, text=f'c{number}', device_id=f'phone-{number % 2}',
                                        author_name='Ion' if number else '')
        hidden = StoryComment.objects.create(story=self.story, text='spam', device_id='phone-0', is_hidden=True)

        first = self.get(device_id='phone-0')
        self.assertEqual(first['Cache-Control'], 'private, no-store')
        body = first.json()
        self.assertEqual(body['count'], 65)
        self.assertEqual([item['text'] for item in body['comments']], [f'c{n}' for n in range(64, 34, -1)])
        self.assertEqual([item['mine'] for item in body['comments'][:2]], [True, False])
        self.assertNotIn('device_id', body['comments'][0])
        self.assertNotIn('spam', first.content.decode())

        second = self.get(device_id='phone-0', before=body['next_before']).json()
        self.assertEqual(second['comments'][0]['text'], 'c34')
        third = self.get(before=second['next_before']).json()
        self.assertEqual([item['text'] for item in third['comments']], ['c4', 'c3', 'c2', 'c1', 'c0'])
        self.assertIsNone(third['next_before'])
        self.assertEqual(third['comments'][-1]['author_name'], 'Ascultător')
        self.assertFalse(any(item['mine'] for item in third['comments']))  # no device_id: nothing is mine
        self.assertNotIn(hidden.pk, [item['id'] for item in first.json()['comments']])

    def test_two_devices_never_share_a_cached_page(self):
        StoryComment.objects.create(story=self.story, text='Amin', device_id='phone-1')

        mine = self.get(device_id='phone-1').json()['comments'][0]['mine']
        theirs = self.get(device_id='phone-2').json()['comments'][0]['mine']

        self.assertEqual((mine, theirs), (True, False))

    def test_a_story_with_comments_off_lists_none(self):
        StoryComment.objects.create(story=self.story, text='Amin')
        self.story.comments_enabled = False
        self.story.save()
        self.assertEqual(self.get().json(), {'count': 0, 'comments': [], 'next_before': None})

    def test_moderation_hides_a_comment_from_the_list_and_the_count(self):
        kept = StoryComment.objects.create(story=self.story, text='Amin')
        spam = StoryComment.objects.create(story=self.story, text='Cumpără acum')

        StoryComment.objects.filter(pk=spam.pk).update(is_hidden=True)

        body = self.get().json()
        self.assertEqual((body['count'], [item['id'] for item in body['comments']]), (1, [kept.pk]))
        self.assertEqual(self.client.get(LIST_URL).json()['stories'][0]['comments']['count'], 1)

    # ------------------------------------------------------------ DELETE

    def test_only_the_authors_device_deletes(self):
        comment = StoryComment.objects.create(story=self.story, text='Amin', device_id='phone-1')
        url = comments_url(comment_id=comment.pk)

        self.assertEqual(self.client.delete(url + '?device_id=phone-2').status_code, 403)
        self.assertEqual(self.client.delete(url).status_code, 403)
        self.assertEqual(self.client.delete(comments_url('alta-poveste', comment.pk) + '?device_id=phone-1')
                         .status_code, 404)
        self.assertEqual(self.client.delete(comments_url(comment_id=999999) + '?device_id=phone-1').status_code, 404)
        self.assertTrue(StoryComment.objects.exists())

        self.assertEqual(self.client.delete(url + '?device_id=phone-1').status_code, 204)
        self.assertFalse(StoryComment.objects.exists())
        self.assertEqual(self.client.delete(url + '?device_id=phone-1').status_code, 404)

    def test_options_answers_cors(self):
        response = self.client.options(comments_url())
        self.assertEqual(response['Access-Control-Allow-Methods'], 'GET, POST, DELETE, OPTIONS')


class CleanTextTests(TestCase):
    def test_plain_text_only(self):
        self.assertEqual(story_comments.clean_text('a\r\n\r\n\r\n\r\nb<br>c\x00'), 'a\n\nbc')
        self.assertEqual(story_comments.clean_text('1 < 2 & 3 > 2'), '1 < 2 & 3 > 2')


@override_settings(CACHES=LOCMEM_CACHE)
class StoryCommentsAdminTests(TemporaryMediaMixin, TestCase):
    def setUp(self):
        self.client.force_login(get_user_model().objects.create_superuser(email='admin@example.com', password='x'))
        self.story = make_story('rugaciune', comments_enabled=True, comments_placeholder='Scrie un gând',
                                author_name='Ana')
        StorySlide.objects.filter(story=self.story).update(caption='O seară de colinde', cta_style='button',
                                                           cta_label='Bilete', cta_target='url',
                                                           cta_url='https://example.com', cta_color='#FFC107')
        self.comments = [StoryComment.objects.create(story=self.story, slide=self.story.slides.get(),
                                                     text=f'Comentariul {number}', platform='ios',
                                                     device_id=f'phone-{number}') for number in range(3)]

    def test_story_list_counts_comments_and_links_to_them(self):
        page = self.client.get(reverse('admin:radio_crestin_story_changelist')).content.decode()
        self.assertIn(f'?story__id__exact={self.story.pk}', page)

        listed = self.client.get(reverse('admin:radio_crestin_storycomment_changelist'),
                                 {'story__id__exact': self.story.pk})
        self.assertEqual(listed.status_code, 200)
        self.assertIn('Comentariul 2', listed.content.decode())
        self.assertEqual(self.client.get(reverse('admin:radio_crestin_storycomment_add')).status_code, 403)

    def test_change_page_shows_the_new_fields_comments_and_the_preview(self):
        page = self.client.get(reverse('admin:radio_crestin_story_change', args=(self.story.pk,))).content.decode()

        for text in ('comments_enabled', 'comments_placeholder', 'author_name', 'author_avatar',
                     'slides-0-caption', 'slides-0-cta_color', 'slides-0-cta_text_color',
                     'Comentariul 0', 'O seară de colinde', 'background: #FFC107'):
            self.assertIn(text, page)

    def test_hide_and_show_actions_and_delete(self):
        url = reverse('admin:radio_crestin_storycomment_changelist')
        spam = self.comments[0]

        self.client.post(url, {'action': 'hide_action', '_selected_action': [spam.pk]})
        spam.refresh_from_db()
        self.assertTrue(spam.is_hidden)
        self.assertEqual(self.client.get(comments_url()).json()['count'], 2)

        self.client.post(url, {'action': 'show_action', '_selected_action': [spam.pk]})
        spam.refresh_from_db()
        self.assertFalse(spam.is_hidden)

        delete = reverse('admin:radio_crestin_storycomment_delete', args=(spam.pk,))
        self.assertEqual(self.client.post(delete, {'post': 'yes'}).status_code, 302)
        self.assertFalse(StoryComment.objects.filter(pk=spam.pk).exists())

    def test_a_comment_page_edits_only_hidden(self):
        comment = self.comments[1]
        url = reverse('admin:radio_crestin_storycomment_change', args=(comment.pk,))
        page = self.client.get(url).content.decode()
        self.assertIn('name="is_hidden"', page)
        self.assertNotIn('name="text"', page)

        self.client.post(url, {'is_hidden': 'on'})
        comment.refresh_from_db()
        self.assertEqual((comment.is_hidden, comment.text), (True, 'Comentariul 1'))


class StoryCommentsMigrationTests(TestCase):
    """The data check of 0084 is in test_announcement_migrations (one migration test for the whole app)."""

    def test_models_match_the_migrations(self):
        call_command('makemigrations', 'radio_crestin', '--check', '--dry-run', verbosity=0)
