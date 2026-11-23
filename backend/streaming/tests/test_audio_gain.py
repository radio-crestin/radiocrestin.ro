"""audio_gain.sh: AUDIO_GAIN_DB becomes ffmpeg -af args (a limiter only on a
boost, nothing at 0 or for junk), and those args really move the loudness
by the gain when ffmpeg is installed."""

import re
import shutil
import subprocess
import unittest
from pathlib import Path

AUDIO_GAIN = Path(__file__).resolve().parent.parent / "live_streaming" / "scripts" / "audio_gain.sh"


def audio_gain_args(gain):
    env = {"PATH": "/usr/bin:/bin"}
    if gain is not None:
        env["AUDIO_GAIN_DB"] = gain
    out = subprocess.run(["bash", "-c", f'. "{AUDIO_GAIN}"; audio_gain_args'],
                         capture_output=True, text=True, env=env, check=True)
    return out.stdout.split()


class AudioGainArgsTests(unittest.TestCase):
    def test_cut_is_a_plain_volume(self):
        self.assertEqual(audio_gain_args("-5.5"), ["-af", "volume=-5.5dB"])

    def test_boost_adds_the_peak_limiter(self):
        limited = "alimiter=limit=0.891:level=0"
        self.assertEqual(audio_gain_args("3"), ["-af", f"volume=3dB,{limited}"])
        self.assertEqual(audio_gain_args("+0.5"), ["-af", f"volume=0.5dB,{limited}"])

    def test_no_filter_without_a_gain(self):
        for gain in (None, "", "0", "-0", "0.0", "+0.00"):
            with self.subTest(gain=gain):
                self.assertEqual(audio_gain_args(gain), [])

    def test_invalid_gain_is_ignored(self):
        for gain in ("loud", "3dB", "1e3", "-", "2;rm -rf /"):
            with self.subTest(gain=gain):
                self.assertEqual(audio_gain_args(gain), [])


@unittest.skipUnless(shutil.which("ffmpeg"), "ffmpeg not installed")
class AudioGainLoudnessTests(unittest.TestCase):
    """A tone peaking at -38 dBFS (lavfi's sine is -18 dBFS, then -20 dB),
    measured after the station's filter."""

    def measure(self, gain):
        args = audio_gain_args(gain)
        chain = (args[1] + "," if args else "") + (
            "astats=measure_overall=Peak_level:measure_perchannel=none,ebur128=framelog=verbose")
        command = ["ffmpeg", "-hide_banner", "-nostats",
                   "-f", "lavfi", "-i", "sine=frequency=1000:duration=6,volume=-20dB",
                   "-af", chain, "-f", "null", "-"]
        stderr = subprocess.run(command, capture_output=True, text=True, check=True).stderr
        lufs = float(re.findall(r"\bI:\s+(-?[\d.]+) LUFS", stderr)[-1])
        peak = float(re.findall(r"Peak level dB: (-?[\d.]+)", stderr)[-1])
        return lufs, peak

    def test_gain_moves_the_loudness_by_that_much(self):
        base, _ = self.measure(None)
        self.assertAlmostEqual(self.measure("-6")[0] - base, -6, delta=0.2)
        self.assertAlmostEqual(self.measure("6")[0] - base, 6, delta=0.2)

    def test_limiter_holds_a_large_boost_at_minus_1_dbfs(self):
        # +44 dB would put the peak at +6 dBFS.
        _, peak = self.measure("44")
        self.assertAlmostEqual(peak, -1.0, delta=0.2)


if __name__ == "__main__":
    unittest.main()
