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


class IcecastArtistFieldTests(SimpleTestCase):
    def test_the_artist_field_keeps_the_title_whole(self):
        from superapp.apps.radio_crestin_scraping.scrapers.icecast import IcecastScraper
        data = IcecastScraper().extract_data({'icestats': {'source': {
            'artist': 'Cuvântul la vremea potrivită', 'title': 'Chivotul - Valentin Popovici', 'listeners': 6}}})
        self.assertEqual((data.current_song.artist, data.current_song.name),
                         ('Cuvântul la vremea potrivită', 'Chivotul - Valentin Popovici'))

    def test_without_an_artist_the_title_is_split(self):
        from superapp.apps.radio_crestin_scraping.scrapers.icecast import IcecastScraper
        data = IcecastScraper().extract_data({'icestats': {'source': {'title': 'Familia Pascal - Ce bucurie'}}})
        self.assertEqual((data.current_song.artist, data.current_song.name), ('Familia Pascal', 'Ce bucurie'))

    def test_scraped_text_encoded_twice_is_repaired(self):
        from superapp.apps.radio_crestin_scraping.utils.formatters import DataFormatter
        self.assertEqual(DataFormatter.clean_song_text('GÃ¢ndiÈ\x9bi-vÄ\x83 la lucrurile de sus'),
                         'Gândiți-vă la lucrurile de sus')
