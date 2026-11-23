from django.test import SimpleTestCase

from ..services.song_text import clean_song_text


class CleanSongTextTests(SimpleTestCase):
    def test_ffmpeg_log_lines_are_rejected(self):
        for line in (
            '[aac @ 0x55d5c8a3e2c0] channel element 3.1 is not allocated',
            '[mp3float @ 000001d2c3e4f5a0] Header missing',
            'ChannelElement 3.1 missing',
        ):
            with self.subTest(line=line):
                self.assertIsNone(clean_song_text(line))

    def test_titles_with_brackets_and_at_signs_survive(self):
        for title in ('[Live @ 2024] Isus', '[Live @ Sala Palatului] Har',
                      'Cântare @ Biserica Betel'):
            with self.subTest(title=title):
                self.assertEqual(clean_song_text(title), title)

    def test_text_encoded_twice_is_repaired(self):
        # As sent by bacau.rve.ro on 2026-11-23.
        self.assertEqual(clean_song_text('GÃ¢ndiÈ\x9bi-vÄ\x83 la lucrurile de sus -'),
                         'Gândiți-vă la lucrurile de sus')

    def test_real_text_is_not_touched(self):
        for text in ('Gândiți-vă la lucrurile de sus', 'Café del Mar', 'Ce bucurie', 'Ştefan Ţurcanu'):
            with self.subTest(text=text):
                self.assertEqual(clean_song_text(text), text)

    def test_a_dangling_separator_is_dropped(self):
        self.assertEqual(clean_song_text('Lada cu zestre -'), 'Lada cu zestre')
        self.assertIsNone(clean_song_text(' - '))

    def test_source_noise_is_tidied(self):
        for raw, clean in (
            ('﻿Natalia Cotan', 'Natalia Cotan'),       # radio-filadelfia ID3
            ('Mesia.mp3', 'Mesia'),                           # calea-spre-cer-copii
            ('Duh_&_Adevar (34:09)', 'Duh & Adevar (34:09)'), # sos-ploiesti
        ):
            with self.subTest(raw=raw):
                self.assertEqual(clean_song_text(raw), clean)

    def test_placeholders_and_web_addresses_are_not_song_text(self):
        for text in ('Unknown Artist', 'LIVE', 'My Station name', 'www.rvesv.ro', 'https://radio.example.com'):
            with self.subTest(text=text):
                self.assertIsNone(clean_song_text(text))
