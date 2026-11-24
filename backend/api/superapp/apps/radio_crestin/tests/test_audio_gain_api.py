"""audio_gain_db reaches the clients: GraphQL, /api/v1/stations, and a change
shows up in the next cache window and rebuilds the website (its static JSON)."""
import os
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings

from ..graphql.rest_endpoints import rounded_timestamp
from ..models import Stations
from ..services import web_deploy
from .helpers import make_station

LOCMEM_CACHE = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
APPLY_ASYNC = 'superapp.apps.radio_crestin.tasks.trigger_web_deploy.trigger_web_deploy.apply_async'


@override_settings(CACHES=LOCMEM_CACHE,
                   DEBUG_TOOLBAR_CONFIG={"SHOW_TOOLBAR_CALLBACK": lambda request: False})
class AudioGainApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.loud = make_station('loud', audio_gain_db=-4.5)
        self.plain = make_station('plain')

    def rest_gains(self, ts):
        response = self.client.get('/api/v1/stations', {'timestamp': ts})
        self.assertEqual(response.status_code, 200)
        return {s['slug']: s['audio_gain_db'] for s in response.json()['data']['stations']}

    def test_graphql_exposes_gain_as_float_default_zero(self):
        response = self.client.get('/graphql', {'query': '{ stations { slug audio_gain_db } }'})
        gains = {s['slug']: s['audio_gain_db'] for s in response.json()['data']['stations']}
        self.assertEqual(gains, {'loud': -4.5, 'plain': 0.0})

    def test_rest_stations_exposes_gain(self):
        self.assertEqual(self.rest_gains(rounded_timestamp()), {'loud': -4.5, 'plain': 0.0})

    def test_gain_change_shows_in_next_cache_window(self):
        ts = rounded_timestamp()
        self.assertEqual(self.rest_gains(ts)['loud'], -4.5)
        Stations.objects.filter(pk=self.loud.pk).update(audio_gain_db=2.0)
        self.assertEqual(self.rest_gains(ts)['loud'], -4.5)  # same window: cached
        self.assertEqual(self.rest_gains(ts - 10)['loud'], 2.0)  # another window: fresh

    def test_gain_change_rebuilds_website(self):
        with patch.dict(os.environ, {web_deploy.HOOK_URL_ENV: 'https://hook.example/x'}), \
                patch(APPLY_ASYNC) as apply_async, self.captureOnCommitCallbacks(execute=True):
            station = Stations.objects.get(pk=self.loud.pk)
            station.audio_gain_db = 1.5
            station.save()
        self.assertTrue(apply_async.called)
