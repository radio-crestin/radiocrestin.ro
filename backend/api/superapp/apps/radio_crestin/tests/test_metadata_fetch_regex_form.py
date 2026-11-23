from django.forms import modelform_factory
from django.test import TestCase

from ..models import StationMetadataFetchCategories, StationsMetadataFetch
from .helpers import make_station


class RegexFormTests(TestCase):
    def test_the_admin_form_shows_and_keeps_the_pattern(self):
        fetch = StationsMetadataFetch.objects.create(
            station=make_station('rve-bacau'),
            station_metadata_fetch_category=StationMetadataFetchCategories.objects.create(slug='stream_id3'),
            url='https://bacau.rve.ro/bacau', artist_regex='^.+ - (.+)$', title_regex='^(.+?) - .+$',
        )
        fetch.refresh_from_db()
        form_class = modelform_factory(StationsMetadataFetch, fields=['artist_regex', 'title_regex', 'priority'])
        form = form_class(instance=fetch)
        self.assertEqual(form['artist_regex'].value(), '^.+ - (.+)$')

        form = form_class({'artist_regex': form['artist_regex'].value(),
                           'title_regex': form['title_regex'].value(), 'priority': 2}, instance=fetch)
        form.save()
        fetch.refresh_from_db()
        self.assertEqual(fetch.artist_regex.pattern, '^.+ - (.+)$')
        self.assertEqual(fetch.title_regex.pattern, '^(.+?) - .+$')
