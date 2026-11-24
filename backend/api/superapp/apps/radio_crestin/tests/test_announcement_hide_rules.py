import json
from dataclasses import replace
from datetime import timedelta
from pathlib import Path

from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from ..forms.announcement_admin import AnnouncementAdminForm, HidePreset
from ..models import Announcement
from ..services.announcement_hide_rules import (
    DeviceCounts, HideRules, comes_back, counts_click, hide_reason, is_hidden, on_click, on_impression,
    on_other_impression, on_playback, on_visit,
)
from .helpers import make_station
from .test_announcement_admin import form_data

CASES = json.loads(
    (Path(__file__).resolve().parents[5] / 'docs' / 'announcement-hide-rules.cases.json').read_text())
LOCMEM_CACHE = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
LIST_URL = '/api/v1/announcements/'
BUTTON = {'action_type': 'external', 'action_label': 'Go', 'action_url': 'https://x.ro'}


class SharedCasesTests(SimpleTestCase):
    """The cases the website and the app copy: the reference implementation passes every one."""

    def test_hide_cases(self):
        self.assertGreater(len(CASES['hide_cases']), 10)
        for case in CASES['hide_cases']:
            with self.subTest(case['name']):
                rules = HideRules.from_payload(case['rules'])
                self.assertEqual(hide_reason(rules, DeviceCounts(**case['counts'])), case['hidden_by'])

    def test_show_again_cases(self):
        for case in CASES['show_again_cases']:
            with self.subTest(case['name']):
                rules, counts = HideRules.from_payload(case['rules']), DeviceCounts(**case['counts'])
                self.assertEqual(is_hidden(rules, counts), case['hidden'])
                self.assertEqual(comes_back(rules, counts), case['comes_back'])

    def test_timelines(self):
        """Replays each timeline (the steps are explained in the cases file's "about")."""
        for timeline in CASES['timelines']:
            with self.subTest(timeline['name']):
                rules, counts, seen = HideRules.from_payload(timeline['rules']), DeviceCounts(), []
                for step in timeline['steps']:
                    if step == 'o' or step.startswith('p'):
                        counts = (on_other_impression(rules, counts) if step == 'o'
                                  else on_playback(rules, counts, step[2:] or 'any-station'))
                        seen.append(step)
                        continue
                    shown, counts = on_visit(rules, counts)
                    if shown:
                        counts = on_impression(rules, counts)
                        if step == 'v+c':
                            counts = on_click(rules, counts)
                        elif step == 'x':
                            counts = replace(counts, dismissed=True)
                    seen.append(step if shown else '-')
                self.assertEqual(seen, timeline['steps'])

    def test_click_cases(self):
        for case in CASES['click_cases']:
            with self.subTest(case['name']):
                rules = HideRules.from_payload({'hide_click_target': case['hide_click_target']})
                event = case['event']
                self.assertEqual(counts_click(rules, event['type'], event.get('target')), case['counts'])


class ModelValidationTests(TestCase):
    def errors(self, **fields):
        announcement = Announcement(slug='concert', title='Concert', icon_name='calendar', **fields)
        try:
            announcement.full_clean()
        except ValidationError as error:
            return error.message_dict
        return {}

    def test_defaults_hide_nothing_after_clicks(self):
        announcement = Announcement(slug='x', title='x')
        self.assertIsNone(announcement.hide_after_clicks)
        self.assertIsNone(announcement.impressions_after_click)
        self.assertEqual(announcement.hide_click_target, 'main')

    def test_valid_combinations(self):
        self.assertEqual(self.errors(hide_after_clicks=1, **BUTTON), {})
        self.assertEqual(self.errors(hide_after_clicks=3, impressions_after_click=5, max_impressions=10, **BUTTON), {})
        self.assertEqual(self.errors(hide_after_clicks=2, hide_click_target='any'), {})  # links in the description

    def test_counts_start_at_one(self):
        self.assertIn('hide_after_clicks', self.errors(hide_after_clicks=0, **BUTTON))
        self.assertIn('impressions_after_click', self.errors(hide_after_clicks=1, impressions_after_click=0, **BUTTON))

    def test_impressions_after_click_needs_clicks(self):
        self.assertIn('impressions_after_click', self.errors(impressions_after_click=2, **BUTTON))

    def test_show_again_needs_both_numbers_and_a_rule_that_hides(self):
        self.assertEqual(self.errors(max_impressions=3, show_again_times=2, show_again_after=5), {})
        self.assertEqual(self.errors(hide_after_clicks=1, show_again_times=1, show_again_after=1, **BUTTON), {})
        self.assertIn('show_again_after', self.errors(max_impressions=3, show_again_times=2))
        self.assertIn('show_again_times', self.errors(max_impressions=3, show_again_after=2))
        self.assertIn('show_again_times', self.errors(show_again_times=2, show_again_after=2))
        self.assertIn('show_again_times', self.errors(max_impressions=3, show_again_times=0, show_again_after=2))
        self.assertIn('show_again_after', self.errors(max_impressions=3, show_again_times=2, show_again_after=0))

    def test_waits_count_one_of_the_known_events(self):
        for count_on in ('impressions', 'visits', 'playbacks'):
            self.assertEqual(self.errors(count_on=count_on, show_after=40), {}, count_on)
        self.assertIn('count_on', self.errors(count_on='downloads', show_after=40))
        self.assertIn('show_after', self.errors(show_after=0))

    def test_share_needs_an_app_version_that_can_share(self):
        share = {'action_type': 'share', 'action_label': 'Share'}
        self.assertIn('min_app_version', self.errors(**share))
        self.assertEqual(self.errors(min_app_version='1.8.0', **share), {})

    def test_main_button_clicks_need_a_button(self):
        self.assertIn('hide_click_target', self.errors(hide_after_clicks=1))
        self.assertIn('hide_click_target', self.errors(hide_after_clicks=1, hide_click_target='bogus', **BUTTON))


class AdminPresetTests(TestCase):
    """The "Hide it" presets; saving through the admin page is in AdminPageTests."""
    def form(self, **overrides):
        form = AnnouncementAdminForm(data=form_data(**{**BUTTON, **overrides}))
        form.is_valid()
        return form

    def test_presets_set_the_fields(self):
        cases = [
            ({'hide_preset': 'never', 'hide_after_clicks': '4', 'impressions_after_click': '2'}, None, None),
            ({'hide_preset': 'one_click', 'hide_after_clicks': '4', 'impressions_after_click': '2'}, 1, None),
            ({'hide_preset': 'clicks', 'hide_after_clicks': '3', 'impressions_after_click': '2'}, 3, None),
            ({'hide_preset': 'clicks_then_impressions', 'hide_after_clicks': '2', 'impressions_after_click': '5'}, 2, 5),
            ({'hide_after_clicks': '2', 'impressions_after_click': '5'}, 2, 5),  # no preset sent: fields as typed
        ]
        for data, clicks, impressions in cases:
            with self.subTest(data):
                form = self.form(**data)
                self.assertEqual(form.errors, {})
                announcement = form.instance  # what form.save() writes
                self.assertEqual((announcement.hide_after_clicks, announcement.impressions_after_click),
                                 (clicks, impressions))
                self.assertEqual(announcement.hide_click_target, 'main')

    def test_presets_require_their_numbers(self):
        self.assertIn('hide_after_clicks', self.form(hide_preset='clicks').errors)
        errors = self.form(hide_preset='clicks_then_impressions', hide_after_clicks='2').errors
        self.assertIn('impressions_after_click', errors)

    def test_model_rules_show_in_the_form(self):
        form = self.form(hide_preset='one_click', action_type='none', action_label='', action_url='')
        self.assertIn('hide_click_target', form.errors)
        self.assertEqual(self.form(hide_preset='one_click', action_type='none', action_label='', action_url='',
                                   hide_click_target='any').errors, {})

    def test_the_form_opens_on_the_saved_preset(self):
        for clicks, impressions, preset in ((None, None, HidePreset.NEVER), (1, None, HidePreset.ONE_CLICK),
                                            (4, None, HidePreset.CLICKS), (1, 3, HidePreset.CLICKS_THEN_IMPRESSIONS)):
            instance = Announcement(hide_after_clicks=clicks, impressions_after_click=impressions)
            self.assertEqual(AnnouncementAdminForm(instance=instance)['hide_preset'].value(), preset)


@override_settings(CACHES=LOCMEM_CACHE)
class AdminPageTests(TestCase):
    def setUp(self):
        self.client.force_login(get_user_model().objects.create_superuser(email='admin@example.com', password='x'))

    def test_hide_it_tab_and_saving_a_preset(self):
        page = self.client.get(reverse('admin:radio_crestin_announcement_add'))
        self.assertContains(page, 'Show &amp; hide')
        self.assertContains(page, 'After clicks, then a few more impressions')
        self.assertContains(page, 'hide_preset ==')  # the click fields show only with their preset
        for name in ('count_on', 'show_after', 'show_again_times', 'show_again_after', 'share_text'):
            self.assertContains(page, f'name="{name}"')
        self.assertContains(page, 'count_on ==')  # the stations list shows only for playbacks

        data = form_data(slug='reminders', hide_preset='clicks_then_impressions', hide_after_clicks='2',
                         impressions_after_click='3', hide_click_target='any', **BUTTON, **{
                             'images-TOTAL_FORMS': '0', 'images-INITIAL_FORMS': '0',
                             'images-MIN_NUM_FORMS': '0', 'images-MAX_NUM_FORMS': '1000'})
        del data['starts_at']
        data.update({'starts_at_0': '2026-11-12', 'starts_at_1': '10:00:00'})
        response = self.client.post(reverse('admin:radio_crestin_announcement_add'), data)
        self.assertEqual(response.status_code, 302, response.content.decode()[:3000])
        saved = Announcement.objects.get(slug='reminders')
        self.assertEqual((saved.hide_after_clicks, saved.impressions_after_click, saved.hide_click_target),
                         (2, 3, 'any'))
        change = self.client.get(reverse('admin:radio_crestin_announcement_change', args=(saved.pk,)))
        self.assertContains(change, 'value="clicks_then_impressions"')
        self.assertEqual(change.context['adminform'].form['hide_preset'].value(), 'clicks_then_impressions')


@override_settings(CACHES=LOCMEM_CACHE)
class ApiTests(TestCase):
    def setUp(self):
        cache.clear()
        Announcement.objects.all().delete()

    def make(self, slug, **fields):
        return Announcement.objects.create(
            slug=slug, title=slug, status='active', starts_at=timezone.now() - timedelta(hours=1), **fields)

    def by_slug(self):
        return {item['slug']: item for item in self.client.get(LIST_URL).json()['announcements']}

    def test_rules_are_sent_only_when_set(self):
        self.make('plain', max_impressions=3)
        self.make('one-click', hide_after_clicks=1, **BUTTON)
        self.make('reminders', hide_after_clicks=2, impressions_after_click=5, hide_click_target='any')
        items = self.by_slug()

        for key in ('hide_after_clicks', 'impressions_after_click', 'hide_click_target',
                    'count_on', 'count_station_slugs', 'show_after', 'show_again_times', 'show_again_after'):
            self.assertNotIn(key, items['plain'])  # older clients see the same payload as before
        self.assertEqual(items['plain']['max_impressions'], 3)
        self.assertEqual(items['one-click']['hide_after_clicks'], 1)
        self.assertEqual(items['one-click']['hide_click_target'], 'main')
        self.assertNotIn('impressions_after_click', items['one-click'])
        self.assertEqual(
            {key: items['reminders'][key] for key in ('hide_after_clicks', 'impressions_after_click', 'hide_click_target')},
            {'hide_after_clicks': 2, 'impressions_after_click': 5, 'hide_click_target': 'any'},
        )

    def test_waits_are_sent_only_when_set(self):
        self.make('rounds', max_impressions=3, show_again_times=2, show_again_after=5)
        share = self.make('share', count_on='playbacks', show_after=40, max_impressions=1, show_again_times=3,
                          show_again_after=150, action_type='share', action_label='Share', min_app_version='1.8.0')
        share.count_stations.set([make_station('radio-x'), make_station('radio-y')])
        self.make('incomplete', max_impressions=3, show_again_times=2)  # a draft the admin would refuse
        items = self.by_slug()

        keys = ('count_on', 'count_station_slugs', 'show_after', 'show_again_times', 'show_again_after')
        self.assertEqual({key: items['rounds'].get(key) for key in keys},
                         {'count_on': 'visits', 'count_station_slugs': None, 'show_after': None,
                          'show_again_times': 2, 'show_again_after': 5})
        self.assertEqual({key: items['share'].get(key) for key in keys},
                         {'count_on': 'playbacks', 'count_station_slugs': ['radio-x', 'radio-y'], 'show_after': 40,
                          'show_again_times': 3, 'show_again_after': 150})
        for key in keys:
            self.assertNotIn(key, items['incomplete'])

    def test_share_action(self):
        self.make('share', action_type='share', action_label='Spune și altora', min_app_version='1.8.0',
                  share_text='Ascultă radio creștin', action_url='https://www.radiocrestin.ro')
        self.make('share-default', action_type='share', action_label='Share', min_app_version='1.8.0')
        items = self.by_slug()
        self.assertEqual(items['share']['button']['action'], {
            'type': 'share', 'url': 'https://www.radiocrestin.ro', 'share_text': 'Ascultă radio creștin'})
        self.assertEqual(items['share-default']['button']['action'], {'type': 'share'})
        self.assertEqual(items['share']['filters']['min_app_version'], '1.8.0')

    def test_detail_sends_the_rules_too(self):
        self.make('one-click', hide_after_clicks=1, **BUTTON)
        item = self.client.get(f'{LIST_URL}one-click/').json()
        self.assertEqual(item['hide_after_clicks'], 1)
        self.assertEqual(item['hide_click_target'], 'main')

    def test_api_payload_reads_back_as_the_reference_rules(self):
        self.make('reminders', hide_after_clicks=2, impressions_after_click=5, max_impressions=9, **BUTTON)
        rules = HideRules.from_payload(self.by_slug()['reminders'])
        self.assertEqual(rules, HideRules(dismissible=True, max_impressions=9, hide_after_clicks=2,
                                          impressions_after_click=5, hide_click_target='main'))
        self.make('share', count_on='playbacks', show_after=40, max_impressions=1, show_again_times=3,
                  show_again_after=150, action_type='share', action_label='Share', min_app_version='1.8.0')
        rules = HideRules.from_payload(self.by_slug()['share'])
        self.assertEqual((rules.count_on, rules.show_after, rules.show_again_times, rules.show_again_after),
                         ('playbacks', 40, 3, 150))
