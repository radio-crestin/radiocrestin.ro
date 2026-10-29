// The Radio Crestin origin publishes index-2m.m3u8 next to each station's
// index.m3u8: byte for byte the same playlist except its #EXT-X-START, which
// starts playback 2 minutes behind live instead of index.m3u8's near-live
// -18s join hint. hls.js prefers a playlist's EXT-X-START over
// liveSyncDuration, so from index.m3u8 the player starts — and stays —
// ~18s behind live, with a buffer too short to ride out an origin that stops
// answering for a while. Mirrors the mobile app's HlsStartVariant.

const ORIGIN_HOSTS = new Set(["hls.radiocrestin.ro", "live.radiocrestin.ro"]);
const LIVE_PLAYLIST = "index.m3u8";
const START_VARIANT_PLAYLIST = "index-2m.m3u8";

/**
 * The 2-minute start variant of an origin `index.m3u8` URL, query kept.
 * Null for other hosts and other playlists.
 */
export const hlsStartVariantUrl = (streamUrl: string): string | null => {
  let url: URL;
  try {
    url = new URL(streamUrl);
  } catch {
    return null;
  }
  if (!ORIGIN_HOSTS.has(url.hostname)) return null;
  if (!url.pathname.endsWith(`/${LIVE_PLAYLIST}`)) return null;
  url.pathname =
    url.pathname.slice(0, -LIVE_PLAYLIST.length) + START_VARIANT_PLAYLIST;
  return url.toString();
};

export const isHlsStartVariantUrl = (streamUrl: string): boolean => {
  try {
    return new URL(streamUrl).pathname.endsWith(`/${START_VARIANT_PLAYLIST}`);
  } catch {
    return false;
  }
};
