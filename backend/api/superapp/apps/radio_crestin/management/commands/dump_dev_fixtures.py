"""Dump the development fixture (fixtures/fixtures.json) without personal data or secrets.

Every station with its configuration, groups, streams, scrapers, playlist,
latest uptime and now playing (plus those songs and artists), posts,
announcements, forms and the Celery beat schedule. Left out: users, sessions,
app users and listening data, reviews, contact messages, share links, analytics,
backups, task results and song history. Blanked: station playlist API keys,
private-station device lists, announcement test devices and the preview token.

From production (the image's root is read-only, so write to /tmp):
  kubectl exec -n radio-crestin-production deploy/radio-crestin-radio-crestin-backend-web -c web -- \\
    sh -c 'python manage.py dump_dev_fixtures --output /tmp/fixtures.json >/dev/null && cat /tmp/fixtures.json' \\
    > fixtures/fixtures.json
"""

import json
from itertools import chain

from django.apps import apps
from django.core import serializers
from django.core.management.base import BaseCommand

MODELS = [
    'radio_crestin.StationGroups', 'radio_crestin.StationMetadataFetchCategories',
    'radio_crestin.Stations', 'radio_crestin.StationToStationGroup', 'radio_crestin.StationStreams',
    'radio_crestin.StationsMetadataFetch', 'radio_crestin.StationPlaylistItems',
    'radio_crestin.StationsUptime', 'radio_crestin.StationsNowPlaying', 'radio_crestin.Posts',
    'radio_crestin.Form', 'radio_crestin.FormQuestion',
    'radio_crestin.AnnouncementCategory', 'radio_crestin.AnnouncementSettings',
    'radio_crestin.Announcement', 'radio_crestin.AnnouncementImage',
    'radio_crestin.SessionRecordingConfig',
    'django_celery_beat.IntervalSchedule', 'django_celery_beat.CrontabSchedule',
    'django_celery_beat.PeriodicTask', 'django_celery_beat.PeriodicTasks',
]

BLANKED = {
    'radio_crestin.stations': {'playlist_api_key': '', 'visible_to_devices': []},
    'radio_crestin.announcement': {'test_devices': []},
    'radio_crestin.announcementsettings': {'preview_token': ''},
}


def now_playing_songs_and_artists():
    now_playing = apps.get_model('radio_crestin.StationsNowPlaying').objects.exclude(song=None)
    songs = apps.get_model('radio_crestin.Songs').objects.filter(id__in=now_playing.values('song'))
    artists = apps.get_model('radio_crestin.Artists').objects.filter(id__in=songs.exclude(artist=None).values('artist'))
    return [artists, songs]


def by_model_then_pk(rows):
    """Rows grouped by model in dump order, each model's rows by pk. Loading in
    pk order lets a row a migration created (e.g. the azuracast category, at a
    low pk in a fresh database) be overwritten before its slug is needed."""
    model_order = list(dict.fromkeys(row['model'] for row in rows))
    return sorted(rows, key=lambda row: (model_order.index(row['model']), row['pk'] is None, row['pk'] or 0))


class Command(BaseCommand):
    help = 'Dump the development fixture without personal data or secrets.'

    def add_arguments(self, parser):
        parser.add_argument('--output', default='fixtures/fixtures.json')

    def handle(self, *args, output, **options):
        querysets = now_playing_songs_and_artists() + [apps.get_model(label).objects.all() for label in MODELS]
        rows = json.loads(serializers.serialize(
            'json', chain(*querysets), use_natural_foreign_keys=True, use_natural_primary_keys=True))
        for row in rows:
            row['fields'].update(BLANKED.get(row['model'], {}))
        with open(output, 'w') as f:
            json.dump(by_model_then_pk(rows), f, indent=2, ensure_ascii=False)
            f.write('\n')
        self.stdout.write(f'Wrote {len(rows)} objects to {output}')
