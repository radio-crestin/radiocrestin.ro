"""Measure how loud each station's HLS stream is and suggest its audio gain.

Listens to every station's live HLS stream at once for --minutes (15 by
default), measures its integrated loudness (EBU R128, LUFS) with ffmpeg's
ebur128 filter, and prints the gain that brings it to --target LUFS. Store
the gain in the station's "Audio gain (dB)" field (admin, Streaming tab); the
stream controller passes it to the station's pod as AUDIO_GAIN_DB and ffmpeg
applies it (live_streaming/scripts/audio_gain.sh).

  python3 tools/measure_loudness.py                      # all stations, 15 min
  python3 tools/measure_loudness.py --minutes 2 --only radio-a,radio-b
  python3 tools/measure_loudness.py --json gains.json    # also save the results

The stream measured already carries the station's current gain, so the
suggested gain is current + (target - measured): run it again any time and
it corrects the gains in place instead of stacking them. A boost stops where
the loudest peak would go more than MAX_LIMITING_DB into the limiter, so a
quiet station with loud peaks may stay below the target.

Needs ffmpeg on PATH. Standard library only.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass

# GraphQL, not /api/v1/stations: that REST payload has no audio_gain_db, so
# every current gain read as 0 and a re-run stacked new gains on old ones.
STATIONS_URL = "https://api.radiocrestin.ro/v1/graphql?" + urllib.parse.urlencode(
    {"query": "{ stations { slug hls_stream_url audio_gain_db } }"})
# -16 LUFS: the AES streaming recommendation (TD1008), the level Apple Music
# and most podcast apps play at; loud enough on a phone at full volume.
DEFAULT_TARGET_LUFS = -16.0
# A larger correction means a broken or silent stream, not a quiet station.
MAX_GAIN_DB = 12.0
# A boost may push the loudest peak this far into the pod's -1 dBFS limiter
# (audio_gain.sh); more and the limiter audibly squashes a quiet station.
LIMITER_PEAK = -1.0
MAX_LIMITING_DB = 3.0
GAIN_STEP_DB = 0.5

_SUMMARY = {
    "integrated_lufs": re.compile(r"\bI:\s+(-?[\d.]+|-inf) LUFS"),
    "loudness_range_lu": re.compile(r"\bLRA:\s+(-?[\d.]+) LU"),
    "true_peak_dbfs": re.compile(r"\bPeak:\s+(-?[\d.]+|-inf) dBFS"),
}


@dataclass
class Measurement:
    slug: str
    current_gain_db: float
    integrated_lufs: float | None = None
    loudness_range_lu: float | None = None
    true_peak_dbfs: float | None = None
    suggested_gain_db: float | None = None
    error: str = ""


def fetch_stations() -> list[dict]:
    # The API's CDN refuses urllib's default User-Agent.
    request = urllib.request.Request(STATIONS_URL, headers={"User-Agent": "radiocrestin-measure-loudness"})
    with urllib.request.urlopen(request, timeout=30) as resp:
        stations = json.load(resp)["data"]["stations"]
    return [s for s in stations if s.get("hls_stream_url")]


def parse_summary(ffmpeg_stderr: str) -> dict[str, float | None]:
    """The ebur128 summary ffmpeg prints when it ends (the last match wins)."""
    values = {}
    for name, pattern in _SUMMARY.items():
        matches = pattern.findall(ffmpeg_stderr)
        values[name] = None if not matches or matches[-1] == "-inf" else float(matches[-1])
    return values


def suggested_gain(current_gain_db: float, measured_lufs: float, target_lufs: float,
                   true_peak_dbfs: float | None = None) -> float:
    change = target_lufs - measured_lufs
    if true_peak_dbfs is not None and change > 0:
        boost_room = max(0.0, LIMITER_PEAK - true_peak_dbfs + MAX_LIMITING_DB)
        change = min(change, boost_room)
    gain = current_gain_db + change
    gain = max(-MAX_GAIN_DB, min(MAX_GAIN_DB, gain))
    return round(gain / GAIN_STEP_DB) * GAIN_STEP_DB + 0.0  # + 0.0 turns -0.0 into 0.0


def measure(slug: str, url: str, current_gain_db: float, seconds: int, target_lufs: float) -> Measurement:
    result = Measurement(slug=slug, current_gain_db=current_gain_db)
    command = [
        "ffmpeg", "-hide_banner", "-nostats", "-loglevel", "info",
        "-i", url, "-t", str(seconds), "-map", "0:a:0",
        # framelog=verbose keeps the ten-per-second frame lines out of the log.
        "-af", "ebur128=peak=true:framelog=verbose", "-f", "null", "-",
    ]
    try:
        proc = subprocess.run(command, capture_output=True, text=True, timeout=seconds + 120)
    except subprocess.TimeoutExpired:
        result.error = "ffmpeg did not finish"
        return result
    result.__dict__.update(parse_summary(proc.stderr))
    if result.integrated_lufs is None:
        result.error = (proc.stderr.strip().splitlines() or ["no audio"])[-1][:120]
    else:
        result.suggested_gain_db = suggested_gain(
            current_gain_db, result.integrated_lufs, target_lufs, result.true_peak_dbfs)
    return result


def print_table(results: list[Measurement], target_lufs: float) -> None:
    print(f"\nTarget: {target_lufs:.1f} LUFS")
    print(f"{'station':32} {'LUFS':>7} {'LRA':>5} {'peak':>6} {'now dB':>7} {'gain dB':>8}")
    for r in sorted(results, key=lambda r: (r.integrated_lufs is None, r.integrated_lufs or 0)):
        if r.error:
            print(f"{r.slug:32} error: {r.error}")
            continue
        peak = "" if r.true_peak_dbfs is None else f"{r.true_peak_dbfs:.1f}"
        print(f"{r.slug:32} {r.integrated_lufs:7.1f} {r.loudness_range_lu or 0:5.1f} {peak:>6} "
              f"{r.current_gain_db:7.1f} {r.suggested_gain_db:+8.1f}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--minutes", type=float, default=15)
    parser.add_argument("--target", type=float, default=DEFAULT_TARGET_LUFS, help="target loudness, LUFS")
    parser.add_argument("--only", default="", help="comma-separated station slugs")
    parser.add_argument("--json", help="also write the results to this file")
    args = parser.parse_args()

    stations = fetch_stations()
    if args.only:
        wanted = set(args.only.split(","))
        stations = [s for s in stations if s["slug"] in wanted]
    seconds = int(args.minutes * 60)
    print(f"Measuring {len(stations)} stations for {seconds}s each, in parallel...", file=sys.stderr)

    with ThreadPoolExecutor(max_workers=len(stations) or 1) as pool:
        futures = [
            pool.submit(measure, s["slug"], s["hls_stream_url"], float(s.get("audio_gain_db") or 0),
                        seconds, args.target)
            for s in stations
        ]
        results = [f.result() for f in futures]

    print_table(results, args.target)
    if args.json:
        with open(args.json, "w") as f:
            json.dump({"target_lufs": args.target, "seconds": seconds,
                       "stations": [asdict(r) for r in results]}, f, indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
