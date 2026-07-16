// ~50ms of 8-bit mono silence — small enough to inline, long enough that
// play() actually starts the media pipeline instead of rejecting on EOF.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";

/**
 * Probes whether the browser currently allows audio playback with sound
 * without a fresh user gesture (granted after a same-origin click navigation,
 * high media engagement, or a per-site permission). The probe must stay
 * unmuted — muted playback is always allowed and would report a false yes —
 * so it plays a moment of literal silence instead.
 */
export async function canAutoplayAudio(): Promise<boolean> {
  try {
    const probe = new Audio(SILENT_WAV);
    await probe.play();
    probe.pause();
    return true;
  } catch {
    return false;
  }
}
