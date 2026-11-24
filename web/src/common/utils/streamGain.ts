// Station audio gain (`audio_gain_db`, -20..+20 dB) on the web player.
//
// The live HLS stream already has the gain baked in server-side, so it plays
// as it is. A direct stream (the station's own Icecast/Shoutcast URL, or our
// proxy of it) has none: the player applies it so every station, and HLS and
// direct playback of the same station, play about equally loud.
//
//  - Negative gain: scale audio.volume (times the visitor's own volume).
//  - Positive gain: audio.volume can't go above 1, so a Web Audio GainNode
//    with a limiter boosts it ("boost"). That needs a CORS-enabled stream (a
//    MediaElementSource on a cross-origin stream without CORS outputs
//    silence) and a running AudioContext, and only runs on desktop browsers:
//    iOS suspends an AudioContext when the screen locks (the radio would stop
//    in the background) and Android Chrome can do the same. Without a boost,
//    the gain scales audio.volume clamped at 1.0, so a visitor below full
//    volume still gets part of it.
//
// Pure functions only: the Web Audio side lives in audioBoost.ts.

export const MIN_GAIN_DB = -20;
export const MAX_GAIN_DB = 20;

export type StreamKind = "HLS" | "proxied_stream" | "direct_stream";

export interface GainPlan {
  /** The gain this plan applies, in dB (0 on HLS). */
  gainDb: number;
  /** Multiplies the visitor's volume on audio.volume (clamped at 1.0). */
  volumeFactor: number;
  /** Linear gain of the Web Audio GainNode; 1 = no boost (element not routed). */
  boost: number;
}

export const NO_GAIN: GainPlan = { gainDb: 0, volumeFactor: 1, boost: 1 };

export const dbToLinear = (db: number) => Math.pow(10, db / 20);

/** The API's value as a usable gain: a finite number in -20..+20, else 0. */
export function normalizeGainDb(raw: unknown): number {
  const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.min(MAX_GAIN_DB, Math.max(MIN_GAIN_DB, n));
}

/** HLS has the gain baked in; every other stream type is played as the station sends it. */
export const streamNeedsGain = (streamType: StreamKind | null | undefined) =>
  !!streamType && streamType !== "HLS";

/** True when this stream would want a Web Audio boost (a positive gain on a direct stream). */
export const wantsBoost = (streamType: StreamKind | null | undefined, gainDb: unknown) =>
  streamNeedsGain(streamType) && normalizeGainDb(gainDb) > 0;

/**
 * How to play a stream: re-evaluated on every source switch (station change,
 * fallback from HLS to a direct stream and back).
 * `canBoost`: the Web Audio boost is available for this stream (supported
 * browser, CORS-enabled stream, running AudioContext).
 */
export function planStreamGain(
  streamType: StreamKind | null | undefined,
  gainDb: unknown,
  canBoost: boolean,
): GainPlan {
  const db = normalizeGainDb(gainDb);
  if (!streamNeedsGain(streamType) || db === 0) return NO_GAIN;
  const linear = dbToLinear(db);
  if (db > 0 && canBoost) return { gainDb: db, volumeFactor: 1, boost: linear };
  return { gainDb: db, volumeFactor: linear, boost: 1 };
}

/** audio.volume for the visitor's volume (0-100) under a plan, clamped to 0..1. */
export function elementVolume(playerVolume: number, plan: GainPlan): number {
  const v = (playerVolume / 100) * plan.volumeFactor;
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

export interface BoostEnvironment {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  hasAudioContext: boolean;
}

/**
 * Whether this browser may route the player through Web Audio at all: desktop
 * browsers with an AudioContext. Never iOS/iPadOS (the context is suspended
 * when the screen locks, which would stop background playback; audio.volume
 * is read-only there too) nor Android (same background risk).
 */
export function webAudioBoostSupported(env: BoostEnvironment): boolean {
  if (!env.hasAudioContext) return false;
  const ua = env.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return false;
  // iPadOS reports itself as a Mac; only its touch points give it away.
  if (env.platform === "MacIntel" && (env.maxTouchPoints ?? 0) > 1) return false;
  if (/Android/i.test(ua)) return false;
  if (/Mobi/i.test(ua)) return false;
  return true;
}

/** The stream URL without its query (session/ref params), as a key for CORS results. */
export function corsKey(url: string): string {
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
}
