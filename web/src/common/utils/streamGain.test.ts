import { describe, expect, it } from "vitest";
import {
  NO_GAIN,
  corsKey,
  dbToLinear,
  elementVolume,
  normalizeGainDb,
  planStreamGain,
  streamNeedsGain,
  wantsBoost,
  webAudioBoostSupported,
} from "@/utils/streamGain";

describe("normalizeGainDb", () => {
  it("keeps numbers in range", () => {
    expect(normalizeGainDb(-5.5)).toBe(-5.5);
    expect(normalizeGainDb(3)).toBe(3);
    expect(normalizeGainDb(0)).toBe(0);
  });
  it("clamps to -20..+20", () => {
    expect(normalizeGainDb(35)).toBe(20);
    expect(normalizeGainDb(-99)).toBe(-20);
  });
  it("treats missing or junk values as 0", () => {
    expect(normalizeGainDb(undefined)).toBe(0);
    expect(normalizeGainDb(null)).toBe(0);
    expect(normalizeGainDb(NaN)).toBe(0);
    expect(normalizeGainDb(Infinity)).toBe(0);
    expect(normalizeGainDb("")).toBe(0);
    expect(normalizeGainDb("abc")).toBe(0);
  });
  it("accepts numeric strings", () => {
    expect(normalizeGainDb("-4")).toBe(-4);
  });
});

describe("dbToLinear", () => {
  it("maps dB to amplitude", () => {
    expect(dbToLinear(0)).toBe(1);
    expect(dbToLinear(-6)).toBeCloseTo(0.501, 3);
    expect(dbToLinear(6)).toBeCloseTo(1.995, 3);
    expect(dbToLinear(-20)).toBeCloseTo(0.1, 6);
  });
});

describe("HLS / direct choice", () => {
  it("applies gain only to non-HLS streams", () => {
    expect(streamNeedsGain("HLS")).toBe(false);
    expect(streamNeedsGain("direct_stream")).toBe(true);
    expect(streamNeedsGain("proxied_stream")).toBe(true);
    expect(streamNeedsGain(null)).toBe(false);
  });
  it("never plans gain on HLS, whatever the station's value", () => {
    expect(planStreamGain("HLS", -8, true)).toEqual(NO_GAIN);
    expect(planStreamGain("HLS", 8, true)).toEqual(NO_GAIN);
    expect(wantsBoost("HLS", 8)).toBe(false);
  });
  it("re-decides on a source switch: HLS → direct → HLS", () => {
    const seq = (["HLS", "direct_stream", "HLS"] as const).map((t) => planStreamGain(t, -6, false));
    expect(seq[0]).toEqual(NO_GAIN);
    expect(seq[1].volumeFactor).toBeCloseTo(0.501, 3);
    expect(seq[2]).toEqual(NO_GAIN);
  });
  it("plays a zero or missing gain untouched", () => {
    expect(planStreamGain("direct_stream", 0, true)).toEqual(NO_GAIN);
    expect(planStreamGain("direct_stream", undefined, true)).toEqual(NO_GAIN);
  });
});

describe("planStreamGain on a direct stream", () => {
  it("cuts a negative gain with audio.volume, never Web Audio", () => {
    const plan = planStreamGain("direct_stream", -6, true);
    expect(plan.boost).toBe(1);
    expect(plan.volumeFactor).toBeCloseTo(0.501, 3);
    expect(plan.gainDb).toBe(-6);
  });
  it("boosts a positive gain with Web Audio when it can", () => {
    expect(wantsBoost("direct_stream", 6)).toBe(true);
    const plan = planStreamGain("direct_stream", 6, true);
    expect(plan.volumeFactor).toBe(1);
    expect(plan.boost).toBeCloseTo(1.995, 3);
  });
  it("falls back to audio.volume for a positive gain without Web Audio (no CORS, mobile)", () => {
    const plan = planStreamGain("proxied_stream", 6, false);
    expect(plan.boost).toBe(1);
    expect(plan.volumeFactor).toBeCloseTo(1.995, 3);
  });
});

describe("elementVolume", () => {
  it("multiplies the visitor's volume by the cut", () => {
    expect(elementVolume(80, planStreamGain("direct_stream", -6, false))).toBeCloseTo(0.401, 3);
    expect(elementVolume(80, NO_GAIN)).toBeCloseTo(0.8, 6);
  });
  it("clamps a fallback boost at 1.0", () => {
    const plan = planStreamGain("direct_stream", 6, false);
    expect(elementVolume(40, plan)).toBeCloseTo(0.798, 3);
    expect(elementVolume(100, plan)).toBe(1);
  });
  it("leaves the visitor's volume alone when Web Audio boosts", () => {
    expect(elementVolume(30, planStreamGain("direct_stream", 6, true))).toBeCloseTo(0.3, 6);
  });
  it("stays within 0..1", () => {
    expect(elementVolume(0, planStreamGain("direct_stream", 20, false))).toBe(0);
    expect(elementVolume(-10, NO_GAIN)).toBe(0);
  });
});

describe("webAudioBoostSupported", () => {
  const chrome =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
  it("allows desktop browsers with an AudioContext", () => {
    expect(webAudioBoostSupported({ userAgent: chrome, platform: "MacIntel", maxTouchPoints: 0, hasAudioContext: true })).toBe(true);
    expect(
      webAudioBoostSupported({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
        platform: "Win32",
        hasAudioContext: true,
      }),
    ).toBe(true);
  });
  it("refuses without an AudioContext", () => {
    expect(webAudioBoostSupported({ userAgent: chrome, hasAudioContext: false })).toBe(false);
  });
  it("refuses iPhone, iPadOS (desktop UA) and Android: background playback", () => {
    expect(
      webAudioBoostSupported({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        hasAudioContext: true,
      }),
    ).toBe(false);
    expect(
      webAudioBoostSupported({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
        platform: "MacIntel",
        maxTouchPoints: 5,
        hasAudioContext: true,
      }),
    ).toBe(false);
    expect(
      webAudioBoostSupported({
        userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36",
        hasAudioContext: true,
      }),
    ).toBe(false);
  });
});

describe("corsKey", () => {
  it("drops the session query", () => {
    expect(corsKey("https://s.example/radio.mp3?ref=x&s=1")).toBe("https://s.example/radio.mp3");
    expect(corsKey("https://s.example/radio.mp3;")).toBe("https://s.example/radio.mp3;");
  });
});
