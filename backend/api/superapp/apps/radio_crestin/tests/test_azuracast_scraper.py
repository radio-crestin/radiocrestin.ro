from django.test import SimpleTestCase

from superapp.apps.radio_crestin_scraping.scrapers.azuracast import AzuraCastScraper, song_cover_url
from superapp.apps.radio_crestin_scraping.scrapers.factory import ScraperFactory

ART = 'https://radio.example.com/api/station/demo/art'


def now_playing(song, listeners=6):
    return {'listeners': {'current': listeners}, 'now_playing': {'song': song}}


class AzuraCastScraperTests(SimpleTestCase):
    def test_reads_artist_title_cover_and_listeners(self):
        data = AzuraCastScraper().extract_data(now_playing({
            'text': 'Familia Pascal - Ce bucurie', 'artist': 'Familia Pascal', 'title': 'Ce bucurie',
            'art': f'{ART}/d18e52d2edcb1926b598bd60-1794732263.jpg',
        }))
        self.assertEqual((data.current_song.artist, data.current_song.name), ('Familia Pascal', 'Ce bucurie'))
        self.assertEqual(data.current_song.thumbnail_url, f'{ART}/d18e52d2edcb1926b598bd60-1794732263.jpg')
        self.assertEqual(data.listeners, 6)

    def test_the_station_fallback_art_is_not_a_song_cover(self):
        self.assertIsNone(song_cover_url(f'{ART}/eb8ec63fdf67c94c71f5a91b'))
        self.assertIsNone(song_cover_url(None))

    def test_splits_the_text_when_artist_and_title_are_empty(self):
        data = AzuraCastScraper().extract_data(now_playing({'text': 'Armonix - Iubind pe Domnul', 'artist': '', 'title': ''}))
        self.assertEqual((data.current_song.artist, data.current_song.name), ('Armonix', 'Iubind pe Domnul'))

    def test_an_unexpected_response_has_no_song(self):
        self.assertIsNone(AzuraCastScraper().extract_data('<html>').current_song)

    def test_is_registered(self):
        self.assertIsInstance(ScraperFactory.get_scraper('azuracast'), AzuraCastScraper)
