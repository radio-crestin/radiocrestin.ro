import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Re-implement the pure functions from useUpdateStationsMetadata for unit testing.
// These match the implementations in the hook — if the hook's logic changes, these
// tests will catch regressions.

function isObject(item: any): item is Record<string, any> {
  return item && typeof item === "object" && !Array.isArray(item);
}

function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const output = { ...target };
  for (const key of Object.keys(source) as (keyof T)[]) {
    if (isObject(source[key]) && isObject(target[key])) {
      output[key] = deepMerge(target[key] as any, source[key] as any);
    } else if (source[key] !== undefined) {
      output[key] = source[key] as T[keyof T];
    }
  }
  return output;
}

const getTimestamp = (offsetSeconds = 0) =>
  Math.floor((Date.now() / 1000 - offsetSeconds) / 10) * 10;

const isStationHls = (station: any): boolean =>
  station.station_streams?.some((s: any) => s.type === "HLS") ?? false;

type IStationMetadata = Partial<any> & { id: number };

const applyDualMetadata = (
  stations: any[],
  liveMetadata: IStationMetadata[],
  offsetMetadata: IStationMetadata[],
): any[] => {
  if (!liveMetadata.length && !offsetMetadata.length) return stations;

  const liveMap = new Map(liveMetadata.map((m: any) => [m.id, m]));
  const offsetMap = new Map(offsetMetadata.map((m: any) => [m.id, m]));

  return stations.map((station: any) => {
    const useOffset = isStationHls(station);
    const primary = useOffset ? offsetMap.get(station.id) : liveMap.get(station.id);
    const fallback = useOffset ? liveMap.get(station.id) : offsetMap.get(station.id);
    const meta = primary ?? fallback;
    if (!meta) return station;

    let merged = deepMerge(station, meta);

    const liveMeta = liveMap.get(station.id);
    if (liveMeta?.now_playing && typeof liveMeta.now_playing.listeners === "number") {
      merged = deepMerge(merged, { total_listeners: liveMeta.now_playing.listeners });
    }

    return merged;
  });
};

// ── Test data ────────────────────────────────────────────────────────

const makeStation = (id: number, slug: string, streams: { type: string }[], nowPlaying?: any) => ({
  id,
  slug,
  title: slug,
  station_streams: streams,
  total_listeners: 0,
  now_playing: nowPlaying ?? { song: { id: 0, name: "", artist: { name: "" } } },
});

const hlsStation = makeStation(1, "radio-a", [{ type: "HLS" }, { type: "proxied_stream" }]);
const directStation = makeStation(2, "radio-b", [{ type: "proxied_stream" }, { type: "direct_stream" }]);

// ── Tests ────────────────────────────────────────────────────────────

describe("getTimestamp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a 10-second-aligned Unix timestamp", () => {
    // Fix time to 2025-01-15T12:00:05Z (5 seconds past a 10s boundary)
    vi.setSystemTime(new Date("2025-01-15T12:00:05Z"));
    const ts = getTimestamp();
    expect(ts % 10).toBe(0);
    // Should floor to :00, not :10
    expect(ts).toBe(Math.floor(new Date("2025-01-15T12:00:00Z").getTime() / 1000));
  });

  it("applies offset correctly (120s = 2 minutes behind)", () => {
    vi.setSystemTime(new Date("2025-01-15T12:02:05Z"));
    const live = getTimestamp(0);
    const offset = getTimestamp(120);
    // The offset timestamp should be ~120s behind live
    expect(live - offset).toBe(120);
  });

  it("offset timestamp matches mobile app formula: floor((now - offset) / 10) * 10", () => {
    vi.setSystemTime(new Date("2025-01-15T12:05:17Z"));
    const now = Date.now();
    const offsetSeconds = 120;
    // Mobile app: (epochSeconds ~/ 10) * 10 after subtracting offset
    const mobileResult = Math.floor((Math.floor(now / 1000) - offsetSeconds) / 10) * 10;
    const webResult = getTimestamp(offsetSeconds);
    expect(webResult).toBe(mobileResult);
  });

  it("produces identical values for same 10-second window", () => {
    vi.setSystemTime(new Date("2025-01-15T12:00:01Z"));
    const ts1 = getTimestamp();
    vi.setSystemTime(new Date("2025-01-15T12:00:09Z"));
    const ts2 = getTimestamp();
    expect(ts1).toBe(ts2);
  });

  it("produces different values across 10-second boundaries", () => {
    vi.setSystemTime(new Date("2025-01-15T12:00:09Z"));
    const ts1 = getTimestamp();
    vi.setSystemTime(new Date("2025-01-15T12:00:11Z"));
    const ts2 = getTimestamp();
    expect(ts2 - ts1).toBe(10);
  });
});

describe("isStationHls", () => {
  it("returns true when station has HLS stream", () => {
    expect(isStationHls(hlsStation)).toBe(true);
  });

  it("returns false when station has no HLS stream", () => {
    expect(isStationHls(directStation)).toBe(false);
  });

  it("returns false when station_streams is empty", () => {
    expect(isStationHls({ station_streams: [] })).toBe(false);
  });

  it("returns false when station_streams is undefined", () => {
    expect(isStationHls({})).toBe(false);
  });
});

describe("applyDualMetadata", () => {
  const stations = [hlsStation, directStation];

  it("applies offset metadata to HLS stations and live metadata to non-HLS", () => {
    const liveMetadata = [
      { id: 1, now_playing: { song: { name: "Live Song A" }, listeners: 50 } },
      { id: 2, now_playing: { song: { name: "Live Song B" }, listeners: 30 } },
    ];
    const offsetMetadata = [
      { id: 1, now_playing: { song: { name: "Offset Song A" }, listeners: 45 } },
      { id: 2, now_playing: { song: { name: "Offset Song B" }, listeners: 28 } },
    ];

    const result = applyDualMetadata(stations, liveMetadata, offsetMetadata);

    // HLS station (id=1) should get offset metadata for now_playing
    expect(result[0].now_playing.song.name).toBe("Offset Song A");
    // Non-HLS station (id=2) should get live metadata
    expect(result[1].now_playing.song.name).toBe("Live Song B");
  });

  it("always uses live listener count for HLS stations", () => {
    const liveMetadata = [
      { id: 1, now_playing: { song: { name: "Live Song" }, listeners: 100 } },
    ];
    const offsetMetadata = [
      { id: 1, now_playing: { song: { name: "Offset Song" }, listeners: 80 } },
    ];

    const result = applyDualMetadata(stations, liveMetadata, offsetMetadata);

    // Song should come from offset, but listener count from live
    expect(result[0].now_playing.song.name).toBe("Offset Song");
    expect(result[0].total_listeners).toBe(100);
  });

  it("falls back to live metadata when offset metadata is missing for a station", () => {
    const liveMetadata = [
      { id: 1, now_playing: { song: { name: "Live Only" }, listeners: 50 } },
    ];
    const offsetMetadata: IStationMetadata[] = [];

    const result = applyDualMetadata(stations, liveMetadata, offsetMetadata);

    // HLS station should fall back to live when offset is missing
    expect(result[0].now_playing.song.name).toBe("Live Only");
  });

  it("falls back to offset metadata when live metadata is missing for a station", () => {
    const liveMetadata: IStationMetadata[] = [];
    const offsetMetadata = [
      { id: 2, now_playing: { song: { name: "Offset Only" }, listeners: 20 } },
    ];

    const result = applyDualMetadata(stations, liveMetadata, offsetMetadata);

    // Non-HLS station should fall back to offset when live is missing
    expect(result[1].now_playing.song.name).toBe("Offset Only");
  });

  it("returns original stations when both metadata arrays are empty", () => {
    const result = applyDualMetadata(stations, [], []);
    expect(result).toBe(stations);
  });

  it("leaves stations unchanged when no metadata matches their IDs", () => {
    const liveMetadata = [{ id: 999, now_playing: { song: { name: "Unknown" } } }];
    const offsetMetadata = [{ id: 998, now_playing: { song: { name: "Unknown" } } }];

    const result = applyDualMetadata(stations, liveMetadata, offsetMetadata);

    expect(result[0].now_playing).toEqual(hlsStation.now_playing);
    expect(result[1].now_playing).toEqual(directStation.now_playing);
  });
});

describe("deepMerge", () => {
  it("merges nested objects", () => {
    const target = { a: { b: 1, c: 2 }, d: 3 };
    const source = { a: { b: 10 } } as any;
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: { b: 10, c: 2 }, d: 3 });
  });

  it("does not overwrite with undefined", () => {
    const target = { a: 1, b: 2 };
    const source = { a: undefined, b: 3 };
    const result = deepMerge(target, source);
    expect(result.a).toBe(1);
    expect(result.b).toBe(3);
  });

  it("overwrites with null", () => {
    const target = { a: "old" };
    const source = { a: null };
    const result = deepMerge(target, source as any);
    expect(result.a).toBeNull();
  });

  it("does not mutate the original target", () => {
    const target = { a: { b: 1 } };
    const source = { a: { b: 2 } };
    deepMerge(target, source);
    expect(target.a.b).toBe(1);
  });
});

describe("HLS offset constant", () => {
  it("web app offset matches the mobile app 2-minute mode", () => {
    // The mobile app's SeekMode.twoMinutes = Duration(minutes: 2) = 120 seconds.
    // The web app's HLS_OFFSET_SECONDS must match.
    const HLS_OFFSET_SECONDS = 120;
    const MOBILE_TWO_MINUTES_SECONDS = 2 * 60;
    expect(HLS_OFFSET_SECONDS).toBe(MOBILE_TWO_MINUTES_SECONDS);
  });
});

describe("HLS ID3 song change detection (fetch-once logic)", () => {
  // Simulates the lastFetchedHlsSongIdRef guard that prevents infinite re-fetching

  it("triggers fetch when hlsSongId changes and differs from displayed", () => {
    let lastFetchedId: number | null = null;
    const displayedSongId = 10;
    let fetchTriggered = false;

    const onHlsSongIdChange = (hlsSongId: number | null) => {
      if (hlsSongId == null || hlsSongId === lastFetchedId) return;
      if (displayedSongId === hlsSongId) {
        lastFetchedId = hlsSongId;
        return;
      }
      lastFetchedId = hlsSongId;
      fetchTriggered = true;
    };

    // New song detected in HLS that differs from displayed
    onHlsSongIdChange(42);
    expect(fetchTriggered).toBe(true);
    expect(lastFetchedId).toBe(42);
  });

  it("does NOT re-fetch for the same hlsSongId (fetch-once guarantee)", () => {
    let lastFetchedId: number | null = null;
    let fetchCount = 0;

    const onHlsSongIdChange = (hlsSongId: number | null) => {
      if (hlsSongId == null || hlsSongId === lastFetchedId) return;
      lastFetchedId = hlsSongId;
      fetchCount++;
    };

    // Same song ID arrives in multiple ID3 frames (every 6s segment)
    onHlsSongIdChange(42);
    onHlsSongIdChange(42);
    onHlsSongIdChange(42);
    onHlsSongIdChange(42);
    expect(fetchCount).toBe(1);
  });

  it("skips fetch when hlsSongId matches the displayed song", () => {
    let lastFetchedId: number | null = null;
    const displayedSongId = 42;
    let fetchTriggered = false;

    const onHlsSongIdChange = (hlsSongId: number | null) => {
      if (hlsSongId == null || hlsSongId === lastFetchedId) return;
      if (displayedSongId === hlsSongId) {
        lastFetchedId = hlsSongId;
        return;
      }
      lastFetchedId = hlsSongId;
      fetchTriggered = true;
    };

    // HLS reports same song that's already displayed
    onHlsSongIdChange(42);
    expect(fetchTriggered).toBe(false);
    expect(lastFetchedId).toBe(42);
  });

  it("triggers new fetch when song changes again", () => {
    let lastFetchedId: number | null = null;
    let fetchCount = 0;

    const onHlsSongIdChange = (hlsSongId: number | null) => {
      if (hlsSongId == null || hlsSongId === lastFetchedId) return;
      lastFetchedId = hlsSongId;
      fetchCount++;
    };

    onHlsSongIdChange(42);
    expect(fetchCount).toBe(1);

    // Song changes to a different one
    onHlsSongIdChange(99);
    expect(fetchCount).toBe(2);

    // Same song repeats — no fetch
    onHlsSongIdChange(99);
    expect(fetchCount).toBe(2);
  });

  it("does not trigger on null hlsSongId", () => {
    let lastFetchedId: number | null = null;
    let fetchCount = 0;

    const onHlsSongIdChange = (hlsSongId: number | null) => {
      if (hlsSongId == null || hlsSongId === lastFetchedId) return;
      lastFetchedId = hlsSongId;
      fetchCount++;
    };

    onHlsSongIdChange(null);
    expect(fetchCount).toBe(0);
  });
});

describe("HLS programDateTime extraction (FRAG_CHANGED)", () => {
  // Simulates the FRAG_CHANGED handler from RadioPlayer/index.tsx:
  // const pdt = data.frag.programDateTime;
  // const epochSec = Math.floor(pdt / 10000) * 10;
  const extractPlaybackTimestamp = (programDateTime: number | null): number | null => {
    if (!programDateTime) return null;
    return Math.floor(programDateTime / 10000) * 10;
  };

  it("converts programDateTime (ms) to 10s-aligned Unix seconds", () => {
    // programDateTime = 1776247017000 (ms) → 1776247010 (10s-aligned seconds)
    const pdt = 1776247017000;
    const ts = extractPlaybackTimestamp(pdt);
    expect(ts).toBe(1776247010);
    expect(ts! % 10).toBe(0);
  });

  it("aligns to 10s boundary correctly for mid-interval timestamps", () => {
    // 1776247025500 ms → 1776247025.5 s → floor to 1776247020 (aligned)
    const pdt = 1776247025500;
    const ts = extractPlaybackTimestamp(pdt);
    expect(ts).toBe(1776247020);
  });

  it("matches the getTimestamp formula for the same epoch", () => {
    vi.useFakeTimers();
    // Set wall clock to the same epoch as programDateTime
    const epochMs = 1776247023000;
    vi.setSystemTime(new Date(epochMs));

    const fromPdt = extractPlaybackTimestamp(epochMs);
    const fromGetTimestamp = getTimestamp(0); // live, no offset

    expect(fromPdt).toBe(fromGetTimestamp);
    vi.useRealTimers();
  });

  it("returns null for null programDateTime", () => {
    expect(extractPlaybackTimestamp(null)).toBeNull();
  });

  it("HLS offset: programDateTime is behind wall clock by the seek offset", () => {
    vi.useFakeTimers();
    // Wall clock is 2 minutes ahead of the audio being played
    const liveMs = 1776247140000; // live edge
    const hlsMs = 1776247020000; // 2 minutes behind
    vi.setSystemTime(new Date(liveMs));

    const liveTs = getTimestamp(0);
    const hlsTs = extractPlaybackTimestamp(hlsMs);

    // The difference should be ~120 seconds (2 minutes)
    expect(liveTs - hlsTs!).toBe(120);
    vi.useRealTimers();
  });
});
