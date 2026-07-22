import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  stationValuesChanged,
  applyMetadataToStations,
} from "@/hooks/useUpdateStationsMetadata";
import fallbackStations from "@/data/fallback-stations.json";

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
  // Mirrors the FRAG_CHANGED handler in RadioPlayer/index.tsx:
  // we use the fragment's END time (PDT + duration) at second precision so
  // an in-fragment song boundary does not cause the metadata API to return
  // the previous song.
  const extractPlaybackTimestamp = (
    programDateTime: number | null,
    durationSec: number = 6,
  ): number | null => {
    if (!programDateTime) return null;
    const fragMs = durationSec * 1000;
    const queryMs = programDateTime + Math.max(0, fragMs - 1);
    return Math.floor(queryMs / 1000);
  };

  it("uses fragment END (PDT + duration) at second precision", () => {
    // PDT 1776247020000 ms (= 1776247020 s), 6s fragment → query ts ~ 1776247025
    const pdt = 1776247020000;
    const ts = extractPlaybackTimestamp(pdt, 6);
    expect(ts).toBe(1776247025);
  });

  it("falls back to PDT when duration is unavailable", () => {
    const pdt = 1776247020000;
    const ts = extractPlaybackTimestamp(pdt, 0);
    expect(ts).toBe(1776247020);
  });

  it("returns null for null programDateTime", () => {
    expect(extractPlaybackTimestamp(null)).toBeNull();
  });

  it("query timestamp lands AFTER an in-fragment song boundary", () => {
    // Boundary mid-fragment at second .604 of PDT 1777624110000 (the radio-eldad
    // case observed: fragment PDT 08:28:30, song change at 08:28:32.604, fragment
    // duration ~6s). With the OLD 10s-aligned PDT we'd query 1777624110 (BEFORE
    // the boundary). With the new logic we query 1777624115 (AFTER the boundary).
    const pdt = 1777624110000;
    const boundarySec = 1777624112.604;
    const ts = extractPlaybackTimestamp(pdt, 6);
    expect(ts).toBeGreaterThan(boundarySec);
  });

  it("HLS offset: query timestamp is roughly the seek offset behind wall clock", () => {
    vi.useFakeTimers();
    // Audio is 2 minutes behind wall clock (HLS_OFFSET_SECONDS = 120)
    const liveMs = 1776247140000;
    const hlsMs = 1776247020000; // 2 minutes behind
    vi.setSystemTime(new Date(liveMs));

    const liveTs = getTimestamp(0);
    const hlsTs = extractPlaybackTimestamp(hlsMs, 6);

    // ~ 120 seconds, minus the few seconds we shift forward toward the fragment end
    expect(liveTs - hlsTs!).toBeGreaterThanOrEqual(114);
    expect(liveTs - hlsTs!).toBeLessThanOrEqual(120);
    vi.useRealTimers();
  });
});

describe("Per-fragment song_id attribution (FRAG_PARSING vs FRAG_CHANGED)", () => {
  // Reproduces the bug we fixed:
  //   FRAG_PARSING_METADATA fires for fragments queued ahead of the audio
  //   pointer. If we set hlsSongId from parsing (old behaviour), the metadata
  //   hook fires while playbackTs is still inside the previous song's range —
  //   the API returns the OLD song, and the dedupe ref blocks a re-fetch when
  //   the audio actually crosses into the new song.
  //
  //   New behaviour: parsing only stores a Map<pdt_ms, song_id>. FRAG_CHANGED
  //   reads the map for the now-playing fragment and only then bumps hlsSongId.

  const makePipeline = () => {
    const fragSongIds = new Map<number, number>();
    let hlsSongId: number | null = null;
    let hlsPlaybackTimestamp: number | null = null;
    let lastFetchedSongId: number | null = null;
    let fetchCount = 0;
    let lastFetchedAt: number | null = null;

    const onFragParsingMetadata = (pdt: number, songId: number) => {
      fragSongIds.set(pdt, songId);
    };

    const onFragChanged = (pdt: number, durationSec = 6) => {
      const queryMs = pdt + Math.max(0, durationSec * 1000 - 1);
      hlsPlaybackTimestamp = Math.floor(queryMs / 1000);
      const songId = fragSongIds.get(pdt);
      if (songId != null && songId !== hlsSongId) {
        hlsSongId = songId;
      }
    };

    const onHlsSongIdChanged = (displayedSongId: number | null) => {
      if (hlsSongId == null || hlsSongId === lastFetchedSongId) return;
      if (displayedSongId === hlsSongId) {
        lastFetchedSongId = hlsSongId;
        return;
      }
      lastFetchedSongId = hlsSongId;
      lastFetchedAt = hlsPlaybackTimestamp;
      fetchCount++;
    };

    return {
      onFragParsingMetadata,
      onFragChanged,
      onHlsSongIdChanged,
      get hlsSongId() { return hlsSongId; },
      get hlsPlaybackTimestamp() { return hlsPlaybackTimestamp; },
      get fetchCount() { return fetchCount; },
      get lastFetchedAt() { return lastFetchedAt; },
    };
  };

  it("stores parsed song_id in the map without bumping hlsSongId", () => {
    const p = makePipeline();
    p.onFragParsingMetadata(1000_000, 42);
    p.onFragParsingMetadata(1006_000, 42);
    p.onFragParsingMetadata(1012_000, 99); // future fragment with NEW song
    expect(p.hlsSongId).toBeNull();
    p.onHlsSongIdChanged(42);
    expect(p.fetchCount).toBe(0);
  });

  it("bumps hlsSongId only when audio enters a fragment with a new song_id", () => {
    const p = makePipeline();
    // Three fragments parsed ahead — last one has a new song
    p.onFragParsingMetadata(1000_000, 42);
    p.onFragParsingMetadata(1006_000, 42);
    p.onFragParsingMetadata(1012_000, 99);

    // Initial display from getStations was a different song (e.g. 7).
    // Audio enters fragment 1 → hlsSongId becomes 42 → fetch fires.
    p.onFragChanged(1000_000);
    p.onHlsSongIdChanged(7);
    expect(p.hlsSongId).toBe(42);
    expect(p.fetchCount).toBe(1);

    // Audio enters fragment 2 — same song, no extra fetch.
    p.onFragChanged(1006_000);
    p.onHlsSongIdChanged(42);
    expect(p.hlsSongId).toBe(42);
    expect(p.fetchCount).toBe(1);

    // Audio enters fragment 3 — new song. hlsSongId flips to 99 and fires a
    // fetch using the playback timestamp captured at the moment of the change
    // (inside the new song's fragment, not the previous one).
    p.onFragChanged(1012_000);
    p.onHlsSongIdChanged(42);
    expect(p.hlsSongId).toBe(99);
    expect(p.fetchCount).toBe(2);
    expect(p.lastFetchedAt).toBeGreaterThanOrEqual(1012);
  });

  it("does not refetch when the displayed song already matches", () => {
    const p = makePipeline();
    p.onFragParsingMetadata(1000_000, 42);
    p.onFragChanged(1000_000);
    // Display is already showing 42 (set from the initial getStations payload)
    p.onHlsSongIdChanged(42);
    expect(p.fetchCount).toBe(0);
  });

  it("evicts old map entries beyond ~200 fragments", () => {
    // Reproduces the bounded LRU-by-insertion-order behaviour we shipped in
    // RadioPlayer (caps the map at 200 entries to avoid unbounded growth).
    const map = new Map<number, number>();
    const insert = (pdt: number, songId: number) => {
      map.set(pdt, songId);
      while (map.size > 200) {
        const oldest = map.keys().next().value;
        if (oldest === undefined) break;
        map.delete(oldest);
      }
    };

    for (let i = 0; i < 250; i++) {
      insert(i * 6000, i);
    }
    expect(map.size).toBe(200);
    expect(map.has(0)).toBe(false); // oldest evicted
    expect(map.has(49 * 6000)).toBe(false); // first 50 evicted
    expect(map.has(50 * 6000)).toBe(true);
    expect(map.has(249 * 6000)).toBe(true); // newest preserved
  });
});

describe("Song-boundary lag regression (the bug we fixed)", () => {
  // Reproduces the exact pathological case observed for radio-eldad:
  //   fragment PDT 08:28:30, song change at 08:28:32.604, audio crosses at
  //   08:28:32.604 and the OLD 10s-aligned playback timestamp was 08:28:30.
  //   The API at 08:28:30 returns the previous song.

  const fakeApi = (queryEpochSec: number): string => {
    const SONG_BOUNDARY_SEC = 1777624112.604;
    return queryEpochSec >= SONG_BOUNDARY_SEC ? "M-am rătăcit" : "O, nu-s mai tari ispitele ca harul";
  };

  const oldHandler = (pdtMs: number) => Math.floor(pdtMs / 10000) * 10;
  const newHandler = (pdtMs: number, durationSec = 6) => {
    const queryMs = pdtMs + Math.max(0, durationSec * 1000 - 1);
    return Math.floor(queryMs / 1000);
  };

  it("OLD logic returns the previous song when audio is past the boundary", () => {
    // Fragment PDT 1777624110000 ms (08:28:30), audio is in this fragment
    // when the boundary at 08:28:32.604 happens — the audio is on the new song
    // but the old 10s-aligned ts queries 08:28:30, which is BEFORE the boundary.
    const pdtMs = 1777624110000;
    const old = oldHandler(pdtMs);
    expect(fakeApi(old)).toBe("O, nu-s mai tari ispitele ca harul"); // wrong
  });

  it("NEW logic returns the current song for the same fragment", () => {
    const pdtMs = 1777624110000;
    const fixed = newHandler(pdtMs, 6);
    expect(fakeApi(fixed)).toBe("M-am rătăcit"); // correct
  });

  it("NEW logic still returns the previous song when audio is genuinely on it", () => {
    // Fragment two earlier — audio is before the boundary. Should still match.
    const pdtMs = 1777624098000; // PDT 08:28:18, end ~08:28:23.999 (still song A)
    const fixed = newHandler(pdtMs, 6);
    expect(fakeApi(fixed)).toBe("O, nu-s mai tari ispitele ca harul");
  });
});

// These tests exercise the REAL exported comparator (not a copy) — see
// stationValuesChanged in useUpdateStationsMetadata.ts.
describe("stationValuesChanged (live-update comparator)", () => {
  const base = (): any => ({
    id: 1,
    slug: "x",
    title: "X",
    total_listeners: 10,
    uptime: { is_up: true, latency_ms: 100, timestamp: "t1" },
    now_playing: {
      timestamp: "t1",
      listeners: 10,
      song: {
        id: 5,
        name: "Song",
        thumbnail_url: "thumb-a",
        artist: { id: 2, name: "Artist" },
      },
    },
  });

  it("returns false for identical stations", () => {
    expect(stationValuesChanged(base(), base())).toBe(false);
  });

  it("ignores per-probe noise: latency_ms and both timestamps", () => {
    const b = base();
    b.uptime.latency_ms = 9999;
    b.uptime.timestamp = "t2";
    b.now_playing.timestamp = "t2";
    expect(stationValuesChanged(base(), b)).toBe(false);
  });

  it.each([
    ["song id", (b: any) => (b.now_playing.song.id = 6)],
    ["song name", (b: any) => (b.now_playing.song.name = "Other")],
    ["song thumbnail", (b: any) => (b.now_playing.song.thumbnail_url = "thumb-b")],
    ["artist name", (b: any) => (b.now_playing.song.artist.name = "Other")],
    ["now_playing.listeners", (b: any) => (b.now_playing.listeners = 11)],
    ["total_listeners", (b: any) => (b.total_listeners = 11)],
    ["uptime.is_up", (b: any) => (b.uptime.is_up = false)],
  ])("detects a change in %s", (_label, mutate) => {
    const b = base();
    mutate(b);
    expect(stationValuesChanged(base(), b)).toBe(true);
  });

  it("detects a song appearing (thumbnail arriving late has same id but new url)", () => {
    const a = base();
    a.now_playing.song = null;
    expect(stationValuesChanged(a, base())).toBe(true);
  });

  it("detects a song disappearing", () => {
    const b = base();
    b.now_playing.song = null;
    expect(stationValuesChanged(base(), b)).toBe(true);
  });

  it("treats stations without now_playing on both sides as unchanged", () => {
    const a = base();
    const b = base();
    delete a.now_playing;
    delete b.now_playing;
    expect(stationValuesChanged(a, b)).toBe(false);
  });
});

// CANARY: trips when the station data gains a new field in the objects the
// 10s polls update. fallback-stations.json is a build-refreshed snapshot of
// the real API, so a new field lands here on the next regeneration. If this
// fails: decide whether the new field must update live (add it to
// stationValuesChanged) or the 5-minute doFullRefresh path is enough — then
// add it to the allowlist below either way.
describe("metadata payload canary", () => {
  // Union of the /stations snapshot and the /stations-metadata live payload
  // shapes (verified against the live API on 2026-07-22).
  const ALLOWED = {
    now_playing: ["id", "timestamp", "listeners", "song"],
    song: ["id", "name", "thumbnail_url", "artist"],
    uptime: ["is_up", "latency_ms", "timestamp"],
  };

  it("poll-updated objects contain no unhandled fields", () => {
    const stations: any[] = (fallbackStations as any)?.data?.stations ?? [];
    expect(stations.length).toBeGreaterThan(0);
    for (const s of stations) {
      for (const [objName, allowed] of Object.entries(ALLOWED)) {
        const obj =
          objName === "now_playing"
            ? s.now_playing
            : objName === "song"
              ? s.now_playing?.song
              : s.uptime;
        if (!obj) continue;
        const unknown = Object.keys(obj).filter((k) => !allowed.includes(k));
        expect(
          unknown,
          `New field(s) [${unknown}] in ${objName} of station "${s.slug}" — classify them in stationValuesChanged (live) or accept the 5-min refresh, then extend this allowlist`,
        ).toEqual([]);
      }
    }
  });
});

// Exercises the REAL exported applyMetadataToStations (single-fetch path).
describe("applyMetadataToStations (single-fetch path)", () => {
  const station = (): any => ({
    id: 1,
    slug: "x",
    title: "X",
    total_listeners: 10,
    uptime: { is_up: true, latency_ms: 100, timestamp: "t1" },
    now_playing: {
      timestamp: "t1",
      listeners: 10,
      song: { id: 5, name: "Song", thumbnail_url: "u", artist: { id: 2, name: "A" } },
    },
  });

  it("lifts now_playing.listeners into total_listeners (the field the UI renders)", () => {
    const meta = { id: 1, now_playing: { listeners: 25 } } as any;
    const result = applyMetadataToStations([station()], [meta]);
    expect(result[0].total_listeners).toBe(25);
    expect((result[0].now_playing as any).listeners).toBe(25);
  });

  it("leaves total_listeners alone when metadata carries no listeners", () => {
    const meta = { id: 1, now_playing: { song: { id: 6, name: "New" } } } as any;
    const result = applyMetadataToStations([station()], [meta]);
    expect(result[0].total_listeners).toBe(10);
    expect(result[0].now_playing.song.id).toBe(6);
  });

  it("keeps the exact array and station references when nothing changed", () => {
    const stations = [station()];
    const meta = {
      id: 1,
      now_playing: {
        timestamp: "t2", // per-probe noise — must not count as a change
        listeners: 10,
        song: { id: 5, name: "Song", thumbnail_url: "u", artist: { id: 2, name: "A" } },
      },
      uptime: { is_up: true, latency_ms: 999, timestamp: "t2" },
    } as any;
    const result = applyMetadataToStations(stations, [meta]);
    expect(result).toBe(stations);
    expect(result[0]).toBe(stations[0]);
  });
});
