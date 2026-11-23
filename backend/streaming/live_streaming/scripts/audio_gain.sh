#!/bin/bash
# Loudness normalization for the streamer pod. Sourced by entrypoint.sh (and
# by tests/test_audio_gain.py). Defines functions only.
#
# Every station broadcasts at its own loudness (-10 to -20 LUFS), so
# switching stations jumped in volume. Each station gets a fixed gain that
# brings it to about -16 LUFS: its "Audio gain (dB)" field in the admin,
# measured with tools/measure_loudness.py, which the stream controller passes
# as AUDIO_GAIN_DB. A fixed gain, not a live normalizer (loudnorm,
# dynaudnorm): it keeps the station's own dynamics and costs almost no CPU.
#
#   audio_gain_args      print the ffmpeg -af arguments for AUDIO_GAIN_DB,
#                        one per line; nothing when it is unset, 0 or invalid

# A boost would push loud peaks past full scale; the limiter holds them at
# -1 dBFS (0.891). level=0: it only catches peaks, it does not raise the
# output to the limit.
AUDIO_GAIN_LIMITER="alimiter=limit=0.891:level=0"

audio_gain_args() {
    local gain="${AUDIO_GAIN_DB:-}"
    [ -n "$gain" ] || return 0
    if ! [[ "$gain" =~ ^[+-]?[0-9]+(\.[0-9]+)?$ ]]; then
        echo "WARNING: ignoring invalid AUDIO_GAIN_DB=$gain" >&2
        return 0
    fi
    # No digit 1-9: a zero gain ("0", "-0.0"), nothing to do.
    [[ "$gain" =~ [1-9] ]] || return 0
    echo "-af"
    if [[ "$gain" == -* ]]; then
        echo "volume=${gain}dB"
    else
        echo "volume=${gain#+}dB,${AUDIO_GAIN_LIMITER}"
    fi
}
