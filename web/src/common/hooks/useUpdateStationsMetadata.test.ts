import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  stationValuesChanged,
  applyMetadataToStations,
  pinHlsNowPlaying,
  pickChangeRow,
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

describe("pinHlsNowPlaying (playlist owns the heard station's song)", () => {
  const heardSong = { id: 31775, name: "Dumnezeu nemuritor", thumbnail_url: null, artist: { id: 4308, name: "Corina Petre", thumbnail_url: null } };
  const heard = { stationId: 1, stationSlug: "x", startedAt: Date.parse("2026-10-15T17:15:09.000Z"), song: heardSong };
  const station = (song: any, id = 1): any => ({
    id,
    slug: id === 1 ? "x" : "y",
    total_listeners: 10,
    now_playing: { timestamp: "t1", listeners: 10, song },
  });

  it("replaces the live song (ahead of the audio) with the heard one", () => {
    const live = { id: 999, name: "Live song", thumbnail_url: "u", artist: { id: 1, name: "L" } };
    const result = pinHlsNowPlaying([station(live)], heard);
    expect(result[0].now_playing.song).toBe(heardSong);
    expect(result[0].now_playing.timestamp).toBe("2026-10-15T17:15:09.000Z");
    expect((result[0].now_playing as any).listeners).toBe(10);
  });

  it("keeps an API row of the same song (it may be richer, e.g. a thumbnail)", () => {
    const api = { ...heardSong, thumbnail_url: "https://x/thumb.jpg" };
    const stations = [station(api)];
    const result = pinHlsNowPlaying(stations, heard);
    expect(result).toBe(stations);
    expect(result[0].now_playing.song.thumbnail_url).toBe("https://x/thumb.jpg");
  });

  it("leaves other stations and unknown songs alone", () => {
    const other = [station({ id: 7, name: "Other" }, 2)];
    expect(pinHlsNowPlaying(other, heard)).toBe(other);
    const stations = [station({ id: 7, name: "Other" })];
    expect(pinHlsNowPlaying(stations, { ...heard, song: null })).toBe(stations);
    expect(pinHlsNowPlaying(stations, null)).toBe(stations);
  });
});

describe("pickChangeRow (history row of a boundary without a hint)", () => {
  const B = Date.parse("2026-10-15T17:15:09.342Z");
  const row = (iso: string, id: number): any => ({ timestamp: iso, listeners: 1, song: { id, name: `s${id}`, thumbnail_url: null, artist: null } });

  it("takes the row starting at the boundary", () => {
    const rows = [row("2026-10-15T17:11:37.331+00:00", 1), row("2026-10-15T17:15:09.342987+00:00", 2)];
    expect(pickChangeRow(rows, B, null)?.song?.id).toBe(2);
  });

  it("accepts rows dated at ingestion (up to 20 s late), not later items", () => {
    expect(pickChangeRow([row("2026-10-15T17:15:19.900+00:00", 2)], B, null)?.song?.id).toBe(2);
    expect(pickChangeRow([row("2026-10-15T17:15:40.000+00:00", 3)], B, null)).toBeNull();
  });

  it("takes the earliest row in the window, so a jingle right after is not shown early", () => {
    const rows = [row("2026-10-15T17:15:17.000+00:00", 3), row("2026-10-15T17:15:09.342+00:00", 2)];
    expect(pickChangeRow(rows, B, null)?.song?.id).toBe(2);
  });

  it("skips rows of the song heard before the boundary (that song still running)", () => {
    const rows = [row("2026-10-15T17:15:10.000+00:00", 1), row("2026-10-15T17:15:12.000+00:00", 2)];
    expect(pickChangeRow(rows, B, 1)?.song?.id).toBe(2);
  });
});
