"""streaming_station_configs: what a streaming pod reads at start-up."""

import json
import os
from unittest.mock import patch

from django.test import TestCase

from ..models import StationMetadataFetchCategories, StationsMetadataFetch
from .helpers import make_station

POD_KEY = 'test-pod-key'
QUERY = '''query ($slugs: [String!]) { streaming_station_configs(station_slugs: $slugs) {
    slug scrapers { category_slug split_character station_name_regex artist_regex title_regex } } }'''


@patch.dict(os.environ, {'STREAMING_POD_API_KEY': POD_KEY})
class StreamingStationConfigTests(TestCase):
    def test_regexes_are_sent_as_patterns(self):
        StationsMetadataFetch.objects.create(
            station=make_station('rve-bacau'),
            station_metadata_fetch_category=StationMetadataFetchCategories.objects.create(slug='stream_id3'),
            url='https://bacau.rve.ro/bacau', station_name_regex=r'^RFR\s*-\s*',
            artist_regex=r'^.+ - (.+)$', title_regex=r'^(.+?) - .+$',
        )
        response = self.client.post('/graphql', json.dumps({'query': QUERY, 'variables': {'slugs': ['rve-bacau']}}),
                                    content_type='application/json', HTTP_X_STREAMING_API_KEY=POD_KEY)
        scraper = response.json()['data']['streaming_station_configs'][0]['scrapers'][0]
        self.assertEqual(scraper, {
            'category_slug': 'stream_id3', 'split_character': ' - ', 'station_name_regex': r'^RFR\s*-\s*',
            'artist_regex': r'^.+ - (.+)$', 'title_regex': r'^(.+?) - .+$',
        })
