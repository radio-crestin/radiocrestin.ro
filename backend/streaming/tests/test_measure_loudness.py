"""tools/measure_loudness.py: reads ffmpeg's ebur128 summary and turns a
measurement into a gain that corrects the current one (rounded, capped)."""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))

import measure_loudness as ml  # noqa: E402

SUMMARY = """
[Parsed_ebur128_0 @ 0x1] Summary:

  Integrated loudness:
    I:         -10.8 LUFS
    Threshold: -21.0 LUFS

  Loudness range:
    LRA:         2.3 LU

  True peak:
    Peak:        0.6 dBFS
"""


class MeasureLoudnessTests(unittest.TestCase):
    def test_parse_summary(self):
        self.assertEqual(ml.parse_summary(SUMMARY), {
            "integrated_lufs": -10.8, "loudness_range_lu": 2.3, "true_peak_dbfs": 0.6})

    def test_silence_or_no_summary_is_none(self):
        self.assertIsNone(ml.parse_summary("I: -inf LUFS")["integrated_lufs"])
        self.assertIsNone(ml.parse_summary("Connection refused")["integrated_lufs"])

    def test_suggested_gain_corrects_the_current_gain(self):
        self.assertEqual(ml.suggested_gain(0, -10.8, -16), -5.0)
        # Already at -3 dB and still 1.2 dB too loud: -4 dB in total.
        self.assertEqual(ml.suggested_gain(-3, -14.8, -16), -4.0)
        self.assertEqual(ml.suggested_gain(0, -16.1, -16), 0.0)

    def test_boost_stops_at_the_limiter_headroom(self):
        # -29.5 LUFS wants +13.5 dB, but its -6.1 dBFS peak allows 5.1 + 3.
        self.assertEqual(ml.suggested_gain(0, -29.5, -16, -6.1), 8.0)
        # A cut is never held back by the peak, and a peak with no room
        # left holds a boost at 0 instead of turning it into a cut.
        self.assertEqual(ml.suggested_gain(0, -10.2, -16, 2.6), -6.0)
        self.assertEqual(ml.suggested_gain(0, -14.6, -14, 2.6), 0.0)

    def test_suggested_gain_is_capped(self):
        self.assertEqual(ml.suggested_gain(0, -40, -16), ml.MAX_GAIN_DB)
        self.assertEqual(ml.suggested_gain(0, 0, -16), -ml.MAX_GAIN_DB)


if __name__ == "__main__":
    unittest.main()
