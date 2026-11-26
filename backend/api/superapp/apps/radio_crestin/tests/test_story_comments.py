"""Story comments and profiles, author, captions and CTA colours (backend/docs/stories-api.md), fresh counts."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from ..models import AppUsers, Profile, StoryComment, StorySettings, StorySlide
from ..services import story_comments
from .test_stories import LIST_URL, LOCMEM_CACHE, NO_YOUTUBE, PNG, TemporaryMediaMixin, make_story

EVENTS_URL = '/api/v1/stories/events/'


def comments_url(slug='rugaciune', comment_id=None):
    return f'/api/v1/stories/{slug}/comments/' + (f'{comment_id}/' if comment_id else '')


def app_user(device_id):
    return AppUsers.objects.get_or_create(anonymous_id=device_id)[0]


def make_profile(name, device_id=None, avatar=False):
    return Profile.objects.create(
        name=name, app_user=app_user(device_id) if device_id else None,
        avatar=SimpleUploadedFile(f'{name}.png', PNG) if avatar else None,
    )


def comment(story, text, device_id='phone-1', **fields):
    return StoryComment.objects.create(story=story, text=text, user=app_user(device_id), **fields)


def anyone_may_comment():
    settings = StorySettings.load()
    settings.comments_need_profile = False
    settings.save()


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

    def test_comments_author_profile_caption_and_cta_colours(self):
        author = make_profile('Radio Vocea Evangheliei', avatar=True)
        story = make_story('reel', comments_enabled=True, comments_placeholder='  Scrie un gând ', author=author)
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
        self.assertTrue(body['author']['avatar_url'].startswith('http://testserver/media/public/profiles/'))
        first, second = body['slides']
        self.assertEqual(first['caption'], 'Concert de Crăciun\nla Arad')
        self.assertEqual((first['cta']['color'], first['cta']['text_color']), ('#FFC107', '#000000'))
        self.assertEqual((second['cta']['color'], second['cta']['text_color']), (None, None))
        self.assertIsNone(second['caption'])

    def test_author_profile_without_avatar_and_a_deleted_author(self):
        author = make_profile('Ana')
        make_story('named', author=author)
        self.assertEqual(self.client.get(LIST_URL).json()['stories'][0]['author'], {'name': 'Ana', 'avatar_url': None})

        author.delete()
        self.assertIsNone(self.client.get(LIST_URL).json()['stories'][0]['author'])

    def test_colours_are_rrggbb_or_aarrggbb(self):
        story = make_story('checks')
        slide = story.slides.get()
        for bad in ('red', '#FFF', '#FFC1070', '#80FFC1071', 'FFC107'):
            slide.cta_color = bad
            with self.assertRaises(ValidationError, msg=bad) as raised:
                slide.full_clean()
            self.assertIn('cta_color', raised.exception.message_dict)
        slide.cta_color, slide.cta_text_color = '#80ffc107', '#FFFFFF'
        slide.full_clean()
        slide.cta_style, slide.cta_label, slide.cta_target, slide.cta_url = 'button', 'Go', 'url', 'https://e.com'
        slide.save()
        cta = self.client.get('/api/v1/stories/checks/').json()['slides'][0]['cta']
        self.assertEqual((cta['color'], cta['text_color']), ('#80FFC107', '#FFFFFF'))

    def test_like_and_comment_counts_in_the_cached_list_stay_fresh(self):
        story = make_story('concert', comments_enabled=True)
        first = self.client.get(LIST_URL)
        detail = self.client.get('/api/v1/stories/concert/')
        self.assertEqual(first.json()['stories'][0]['like_count'], 0)

        self.client.post(EVENTS_URL, {'device_id': 'phone-1', 'events': [{'type': 'like', 'story': 'concert'}]},
                         content_type='application/json')
        comment(story, 'Amin')
        comment(story, 'spam', device_id='phone-2', is_hidden=True)

        again = self.client.get(LIST_URL, HTTP_IF_NONE_MATCH=first['ETag'])
        self.assertEqual(again.status_code, 200)  # a new body, so a new ETag
        listed = again.json()['stories'][0]
        self.assertEqual((listed['like_count'], listed['comments']['count']), (1, 1))
        one = self.client.get('/api/v1/stories/concert/', HTTP_IF_NONE_MATCH=detail['ETag']).json()
        self.assertEqual((one['like_count'], one['comments']['count']), (1, 1))
        self.assertEqual(self.client.get(LIST_URL, HTTP_IF_NONE_MATCH=again['ETag']).status_code, 304)

    def test_comment_count_is_zero_while_comments_are_off(self):
        comment(make_story('off'), 'Amin')
        self.assertEqual(self.client.get(LIST_URL).json()['stories'][0]['comments']['count'], 0)


@override_settings(CACHES=LOCMEM_CACHE)
class StoryCommentsEndpointTests(TemporaryMediaMixin, TestCase):
    def setUp(self):
        cache.clear()
        self.story = make_story('rugaciune', slides=2, comments_enabled=True)
        self.slide = self.story.slides.order_by('position').last()
        self.ana = make_profile('Ana', device_id='phone-1', avatar=True)

    def post(self, device_id='phone-1', slug='rugaciune', **fields):
        payload = {'device_id': device_id, 'platform': 'android', 'app_version': '1.9.0', 'locale': 'ro-RO',
                   'slide': self.slide.pk, 'text': 'Doamne ajută!'}
        payload.update(fields)
        return self.client.post(comments_url(slug), payload, content_type='application/json')

    def get(self, slug='rugaciune', **params):
        return self.client.get(comments_url(slug), params)

    # ------------------------------------------------------------ POST

    def test_a_profile_comments_under_its_name_and_its_app_user(self):
        response = self.post(text='  Doamne ajută!\n ', author_name='Someone else')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response['Cache-Control'], 'private, no-store')
        body = response.json()['comment']
        stored = StoryComment.objects.get()
        self.assertEqual(body['author_name'], 'Ana')  # the profile's name; a typed name is ignored
        self.assertTrue(body['author_avatar_url'].startswith('http://testserver/media/public/profiles/'))
        self.assertEqual((body['id'], body['text'], body['mine']), (stored.pk, 'Doamne ajută!', True))
        self.assertTrue(body['created_at'].endswith('Z'))
        self.assertEqual((stored.user, stored.profile, stored.slide, stored.platform, stored.locale),
                         (self.ana.app_user, self.ana, self.slide, 'android', 'ro-RO'))
        self.assertNotIn('phone-1', response.content.decode())

    def test_only_profiles_comment_by_default(self):
        AppUsers.objects.create(anonymous_id='phone-2')  # a registered device without a profile

        for device_id in ('phone-2', 'never-registered'):
            response = self.post(device_id=device_id)
            self.assertEqual((response.status_code, response.json()), (403, {'error': 'only profiles can comment'}))
        self.assertFalse(StoryComment.objects.exists())
        self.assertFalse(AppUsers.objects.filter(anonymous_id='never-registered').exists())

        page = self.get(device_id='phone-2').json()
        self.assertEqual((page['can_comment'], page['profile']), (False, None))
        mine = self.get(device_id='phone-1').json()
        self.assertTrue(mine['can_comment'])
        self.assertEqual(mine['profile']['name'], 'Ana')

    def test_with_the_setting_off_any_device_comments_as_ascultator(self):
        anyone_may_comment()

        response = self.post(device_id='never-registered', author_name='Ion')

        self.assertEqual(response.status_code, 201)
        body = response.json()['comment']
        self.assertEqual((body['author_name'], body['author_avatar_url'], body['mine']), ('Ascultător', None, True))
        stored = StoryComment.objects.get()
        self.assertEqual((stored.user.anonymous_id, stored.profile), ('never-registered', None))
        self.assertTrue(self.get(device_id='someone').json()['can_comment'])

    def test_html_is_stripped(self):
        response = self.post(text='<script>alert(1)</script><b>Amin</b>\x07')

        self.assertEqual(response.json()['comment']['text'], 'alert(1)Amin')
        self.assertEqual(self.post(text='<p></p>').json(), {'error': 'text is empty'})

    def test_slide_may_be_null_or_not_this_storys(self):
        other = make_story('alta')
        self.assertEqual(self.post(slide=None).status_code, 201)
        self.assertEqual(self.post(slide=other.slides.get().pk).status_code, 201)
        self.assertEqual(list(StoryComment.objects.values_list('slide', flat=True)), [None, None])

    def test_empty_or_too_long_text_is_refused(self):
        anyone_may_comment()
        for number, text in enumerate(('', '   \n ', None, 42)):
            response = self.post(text=text, device_id=f'phone-{number + 10}')
            self.assertEqual((response.status_code, response.json()), (400, {'error': 'text is empty'}), text)
        self.assertEqual(self.post(text='ă' * 500, device_id='phone-5').status_code, 201)
        too_long = self.post(text='a' * 501, device_id='phone-6')
        self.assertEqual((too_long.status_code, too_long.json()), (400, {'error': 'text is longer than 500 characters'}))
        self.assertEqual(StoryComment.objects.count(), 1)

    def test_comments_off_unknown_or_ended_story(self):
        make_story('fara')
        make_story('ended', comments_enabled=True, ends_at=timezone.now() - timedelta(minutes=1),
                   starts_at=timezone.now() - timedelta(days=1))
        make_story('draft', comments_enabled=True, status='draft')

        off = self.post(slug='fara')
        self.assertEqual((off.status_code, off.json()), (400, {'error': 'comments are off for this story'}))
        self.assertEqual(self.get(slug='fara', device_id='phone-1').json(),
                         {'count': 0, 'comments': [], 'next_before': None, 'can_comment': False,
                          'profile': self.get(device_id='phone-1').json()['profile']})
        for slug in ('ended', 'draft', 'missing'):
            self.assertEqual(self.post(slug=slug).status_code, 404, slug)
            self.assertEqual(self.get(slug=slug).status_code, 404, slug)
        self.assertFalse(StoryComment.objects.exists())

    def test_the_website_posts_text_plain_json_as_web(self):
        make_profile('Echipa', device_id='web-1')
        body = '{"device_id": "web-1", "platform": "web", "app_version": "2026.11", "locale": "ro", "text": "Amin"}'
        response = self.client.post(comments_url(), body, content_type='text/plain;charset=UTF-8',
                                    HTTP_ORIGIN='https://www.radiocrestin.ro')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response['Access-Control-Allow-Origin'], '*')
        self.assertEqual(StoryComment.objects.get().platform, 'web')

    def test_cors_on_every_answer_for_the_website(self):
        mine = comment(self.story, 'Amin', device_id='web-1')
        origin = {'HTTP_ORIGIN': 'https://www.radiocrestin.ro'}
        preflight = self.client.options(comments_url(comment_id=mine.pk), **origin,
                                        HTTP_ACCESS_CONTROL_REQUEST_METHOD='DELETE')
        self.assertEqual(preflight.status_code, 200)
        self.assertIn('DELETE', preflight['Access-Control-Allow-Methods'])
        for response in (self.client.get(comments_url(), {'device_id': 'web-1'}, **origin),
                         self.client.get(comments_url('missing'), **origin),
                         self.client.post(comments_url(), '{"device_id": "web-2", "text": "x"}',
                                          content_type='text/plain', **origin),
                         self.client.delete(comments_url(comment_id=mine.pk) + '?device_id=web-2', **origin),
                         self.client.delete(comments_url(comment_id=mine.pk) + '?device_id=web-1', **origin)):
            self.assertEqual(response['Access-Control-Allow-Origin'], '*', response.status_code)

    def test_device_id_and_json_object_are_required(self):
        self.assertEqual(self.post(device_id='').json(), {'error': 'device_id is required'})
        for body in ('nope', [1]):
            response = self.client.post(comments_url(), body, content_type='application/json')
            self.assertEqual(response.status_code, 400)

    def test_five_a_minute_per_device(self):
        statuses = [self.post().status_code for _ in range(6)]

        self.assertEqual(statuses, [201] * 5 + [429])
        make_profile('Ion', device_id='phone-2')
        self.assertEqual(self.post(device_id='phone-2').status_code, 201)
        self.assertEqual(StoryComment.objects.count(), 6)

    # ------------------------------------------------------------ GET

    def test_pages_newest_first_visible_only_with_mine(self):
        for number in range(65):
            comment(self.story, f'c{number}', device_id=f'phone-{number % 2}',
                    profile=self.ana if number % 2 else None)
        hidden = comment(self.story, 'spam', device_id='phone-0', is_hidden=True)

        first = self.get(device_id='phone-0')
        self.assertEqual(first['Cache-Control'], 'private, no-store')
        body = first.json()
        self.assertEqual(body['count'], 65)
        self.assertEqual([item['text'] for item in body['comments']], [f'c{n}' for n in range(64, 34, -1)])
        self.assertEqual([item['mine'] for item in body['comments'][:2]], [True, False])
        self.assertEqual([item['author_name'] for item in body['comments'][:2]], ['Ascultător', 'Ana'])
        self.assertEqual(set(body['comments'][0]), {'id', 'author_name', 'author_avatar_url', 'text', 'created_at',
                                                    'mine'})
        self.assertNotIn('spam', first.content.decode())
        self.assertNotIn('phone-', first.content.decode())

        second = self.get(device_id='phone-0', before=body['next_before']).json()
        self.assertEqual(second['comments'][0]['text'], 'c34')
        third = self.get(before=second['next_before']).json()
        self.assertEqual([item['text'] for item in third['comments']], ['c4', 'c3', 'c2', 'c1', 'c0'])
        self.assertIsNone(third['next_before'])
        self.assertFalse(any(item['mine'] for item in third['comments']))  # no device_id: nothing is mine
        self.assertNotIn(hidden.pk, [item['id'] for item in body['comments']])

    def test_two_devices_never_share_a_cached_page(self):
        comment(self.story, 'Amin', device_id='phone-1', profile=self.ana)

        mine = self.get(device_id='phone-1').json()['comments'][0]['mine']
        theirs = self.get(device_id='phone-2').json()['comments'][0]['mine']

        self.assertEqual((mine, theirs), (True, False))

    def test_moderation_hides_a_comment_from_the_list_and_the_count(self):
        kept = comment(self.story, 'Amin')
        spam = comment(self.story, 'Cumpără acum')

        StoryComment.objects.filter(pk=spam.pk).update(is_hidden=True)

        body = self.get().json()
        self.assertEqual((body['count'], [item['id'] for item in body['comments']]), (1, [kept.pk]))
        self.assertEqual(self.client.get(LIST_URL).json()['stories'][0]['comments']['count'], 1)

    # ------------------------------------------------------------ DELETE

    def test_only_the_authors_device_deletes(self):
        mine = comment(self.story, 'Amin', device_id='phone-1', profile=self.ana)
        url = comments_url(comment_id=mine.pk)

        self.assertEqual(self.client.delete(url + '?device_id=phone-2').status_code, 403)
        self.assertEqual(self.client.delete(url).status_code, 403)
        self.assertEqual(self.client.delete(comments_url('alta-poveste', mine.pk) + '?device_id=phone-1')
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
        self.ana = make_profile('Ana', device_id='phone-0', avatar=True)
        self.story = make_story('rugaciune', comments_enabled=True, comments_placeholder='Scrie un gând',
                                author=self.ana)
        StorySlide.objects.filter(story=self.story).update(caption='O seară de colinde', cta_style='button',
                                                           cta_label='Bilete', cta_target='url',
                                                           cta_url='https://example.com', cta_color='#FFC107',
                                                           cta_text_color='#80000000')
        self.comments = [comment(self.story, f'Comentariul {number}', device_id=f'phone-{number}',
                                 slide=self.story.slides.get(), platform='ios',
                                 profile=self.ana if number == 0 else None) for number in range(3)]

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

        for text in ('comments_enabled', 'comments_placeholder', 'name="author"',
                     'slides-0-caption', 'slides-0-cta_color', 'slides-0-cta_text_color',
                     'Comentariul 0', 'O seară de colinde', 'background: #FFC107', 'color: #00000080'):
            self.assertIn(text, page)

    def test_hide_and_show_actions_and_delete(self):
        url = reverse('admin:radio_crestin_storycomment_changelist')
        spam = self.comments[1]

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
        item = self.comments[1]
        url = reverse('admin:radio_crestin_storycomment_change', args=(item.pk,))
        page = self.client.get(url).content.decode()
        self.assertIn('name="is_hidden"', page)
        self.assertNotIn('name="text"', page)

        self.client.post(url, {'is_hidden': 'on'})
        item.refresh_from_db()
        self.assertEqual((item.is_hidden, item.text), (True, 'Comentariul 1'))

    def test_the_team_creates_profiles_for_app_users(self):
        self.assertEqual(self.client.get(reverse('admin:radio_crestin_profile_changelist')).status_code, 200)
        device = AppUsers.objects.create(anonymous_id='phone-new')

        response = self.client.post(reverse('admin:radio_crestin_profile_add'),
                                    {'name': 'Radio Vocea', 'app_user': device.pk})

        self.assertEqual(response.status_code, 302, response.content.decode()[:2000])
        self.assertEqual(Profile.objects.get(name='Radio Vocea').app_user, device)
        page = self.client.get(reverse('admin:radio_crestin_profile_change', args=(self.ana.pk,))).content.decode()
        self.assertIn('Ana', page)
        settings = self.client.get(reverse('admin:radio_crestin_storysettings_change',
                                           args=(StorySettings.load().pk,))).content.decode()
        self.assertIn('name="comments_need_profile"', settings)

    def test_one_profile_per_app_user(self):
        response = self.client.post(reverse('admin:radio_crestin_profile_add'),
                                    {'name': 'Again', 'app_user': self.ana.app_user.pk})
        self.assertEqual(response.status_code, 200)  # the form shows the error
        self.assertFalse(Profile.objects.filter(name='Again').exists())


class StoryCommentsMigrationTests(TestCase):
    """The data check of 0084 is in test_announcement_migrations (one migration test for the whole app)."""

    def test_models_match_the_migrations(self):
        call_command('makemigrations', 'radio_crestin', '--check', '--dry-run', verbosity=0)
