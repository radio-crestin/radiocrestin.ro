import { useCallback, useContext, useEffect, useRef } from "react";
import { getStations, getStationsMetadata, getStationSongHistory } from "@/services/getStations";
import type { ISongHistoryItem, IStationMetadata } from "@/services/getStations";
import type { ISong, IStation } from "@/models/Station";
import { Context } from "@/context/ContextProvider";
import { captureException } from "@/utils/posthog";
import { preserveLocalThumbnails } from "@/utils";
import usePlaybackState from "@/store/usePlaybackState";
import type { IHlsNowPlaying } from "@/store/usePlaybackState";

const FULL_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

/** Compute the same 10-second-aligned Unix timestamp the API expects. */
const getTimestamp = (offsetSeconds = 0) =>
  Math.floor((Date.now() / 1000 - offsetSeconds) / 10) * 10;

/** Check if a station's primary stream is HLS. */
const isStationHls = (station: IStation): boolean =>
  station.station_streams?.some(s => s.type === "HLS") ?? false;

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

// INVARIANT the memoized StationCard depends on: station objects are never
// mutated in place on the client — a value change MUST come with a new object
// reference, and an unchanged station SHOULD keep its reference (that is what
// lets unchanged cards skip re-rendering). The helpers below enforce the
// second half for non-differential fetches (the HLS offset fetch returns all
// 64 stations every 10s; blindly merging gave every station a fresh identity
// and defeated the memo for entire HLS sessions).
// Live-update change detection for the 10s polls. Compares ONLY the fields
// the UI renders live between polls — replacing a per-key JSON.stringify
// deep-compare that cost ~500+ serializations (~1MB of transient strings)
// per tick AND was defeated by per-probe noise: uptime.latency_ms and the
// two timestamps jitter on most polls, so ~70% of stations got a fresh
// identity every 10s and their memoized cards re-rendered for nothing
// (measured live: 44/64 flagged by the old diff vs 4/64 by this one).
// Deliberately ignored as noise: now_playing.timestamp, uptime.latency_ms,
// uptime.timestamp, slug/title. Any ignored or future metadata field still
// reaches the UI within 5 minutes — doFullRefresh replaces every station
// object unconditionally. Adding a live-updating field to the metadata
// payload? Add it here and to the canary test in
// useUpdateStationsMetadata.test.ts.
export const stationValuesChanged = (a: IStation, b: IStation): boolean =>
  a.now_playing?.song?.id !== b.now_playing?.song?.id ||
  a.now_playing?.song?.name !== b.now_playing?.song?.name ||
  a.now_playing?.song?.thumbnail_url !== b.now_playing?.song?.thumbnail_url ||
  a.now_playing?.song?.artist?.name !== b.now_playing?.song?.artist?.name ||
  (a.now_playing as any)?.listeners !== (b.now_playing as any)?.listeners ||
  a.total_listeners !== b.total_listeners ||
  a.uptime?.is_up !== b.uptime?.is_up;

export const applyMetadataToStations = (stations: IStation[], metadata: IStationMetadata[]): IStation[] => {
  if (!metadata.length) return stations;

  const metadataMap = new Map(metadata.map(m => [m.id, m]));

  let anyChanged = false;
  const next = stations.map(station => {
    const meta = metadataMap.get(station.id);
    if (!meta) return station;
    let merged = deepMerge(station, meta);
    // The metadata endpoint reports listeners inside now_playing, but the UI
    // renders station.total_listeners — same lift as applyDualMetadata, so
    // counts stay live at 10s on this path too (non-HLS playback / idle
    // browsing) instead of freezing until the 5-minute full refresh.
    if (typeof (meta.now_playing as any)?.listeners === "number") {
      merged = deepMerge(merged, {
        total_listeners: (meta.now_playing as any).listeners,
      });
    }
    if (stationValuesChanged(station, merged)) {
      anyChanged = true;
      return merged;
    }
    return station;
  });
  // A no-change poll keeps the ARRAY reference too — the ctx reducer bails
  // out on identical values, so downstream effects keyed on ctx.stations
  // (sort, favourites) don't re-fire every 10s.
  return anyChanged ? next : stations;
};

/**
 * Merge live + offset metadata into the station list, matching the mobile
 * app's approach: HLS stations get now_playing from the offset fetch (matches
 * the delayed audio), non-HLS stations get live metadata. Listener counts
 * always come from the live fetch.
 */
const applyDualMetadata = (
  stations: IStation[],
  liveMetadata: IStationMetadata[],
  offsetMetadata: IStationMetadata[],
): IStation[] => {
  if (!liveMetadata.length && !offsetMetadata.length) return stations;

  const liveMap = new Map(liveMetadata.map(m => [m.id, m]));
  const offsetMap = new Map(offsetMetadata.map(m => [m.id, m]));

  let anyChanged = false;
  const next = stations.map(station => {
    const useOffset = isStationHls(station);
    const primary = useOffset ? offsetMap.get(station.id) : liveMap.get(station.id);
    const fallback = useOffset ? liveMap.get(station.id) : offsetMap.get(station.id);
    const meta = primary ?? fallback;
    if (!meta) return station;

    let merged = deepMerge(station, meta);

    // Always use live listener count (offset metadata has stale counts)
    const liveMeta = liveMap.get(station.id);
    if (liveMeta?.now_playing && typeof (liveMeta.now_playing as any).listeners === "number") {
      merged = deepMerge(merged, { total_listeners: (liveMeta.now_playing as any).listeners });
    }

    if (stationValuesChanged(station, merged)) {
      anyChanged = true;
      return merged;
    }
    return station;
  });
  // Same as applyMetadataToStations: unchanged polls preserve the array ref.
  return anyChanged ? next : stations;
};

/**
 * Pins the station heard over hls.js to its audible song (IHlsNowPlaying):
 * a poll or full refresh may enrich that song (same id, e.g. a thumbnail),
 * but never replace it with the live one, or with the next one the poll's
 * end-of-fragment timestamp can return a few seconds early. Unpinned while
 * the song is unknown, so the offset poll still covers that gap.
 */
export const pinHlsNowPlaying = (
  stations: IStation[],
  heard: IHlsNowPlaying | null,
): IStation[] => {
  const song = heard?.song;
  if (!heard || !song) return stations;
  let changed = false;
  const next = stations.map((station) => {
    if (station.id !== heard.stationId || station.now_playing?.song?.id === song.id) {
      return station;
    }
    changed = true;
    return {
      ...station,
      now_playing: {
        ...station.now_playing,
        timestamp: new Date(heard.startedAt).toISOString(),
        song,
      },
    };
  });
  return changed ? next : stations;
};

/** A history row sits within ~1 s of its boundary (EPOCH is whole seconds),
 *  or up to ~10 s after it on stations whose rows are dated at ingestion. */
const CHANGE_ROW_LEAD_MS = 1500;
const CHANGE_ROW_LAG_MS = 20_000;

/**
 * The row that starts the song heard from a boundary, for a change the
 * playlist announced without a song hint: the earliest history row in
 * [B − 1.5 s, B + 20 s], skipping rows of the song heard before it (that song
 * still running). The window is the same for every listener of the change,
 * so it is shared from the CDN. Null when absent or the request failed.
 */
export const pickChangeRow = (
  rows: ISongHistoryItem[],
  startedAt: number,
  songBefore: number | null,
): ISongHistoryItem | null => {
  let best: ISongHistoryItem | null = null;
  let bestAt = Infinity;
  for (const row of rows) {
    const at = Date.parse(row.timestamp);
    if (!row.song || !(at >= startedAt - CHANGE_ROW_LEAD_MS && at <= startedAt + CHANGE_ROW_LAG_MS)) {
      continue;
    }
    if (songBefore != null && row.song.id === songBefore) continue;
    if (at < bestAt) {
      best = row;
      bestAt = at;
    }
  }
  return best;
};

/** Gaps between attempts while the change row is not ingested yet: 55 s in
 *  total, above the measured 37.7 s ingestion lag. Playback joins ~20 s
 *  behind live (the playlist's EXT-X-START), so the first try can be early. */
const CHANGE_RETRY_DELAYS_MS = [3000, 7000, 15000, 30000];

const resolveSongChange = async (
  heard: IHlsNowPlaying,
  songBefore: number | null,
  isCurrent: () => boolean,
): Promise<ISong | null> => {
  const b = Math.floor(heard.startedAt / 1000);
  for (let attempt = 0; ; attempt++) {
    // A new to_timestamp per attempt, so a retry never meets the cached copy
    // that lacked the row. The API rejects to > now + 2: stay 2 s behind.
    const to = Math.min(b + CHANGE_ROW_LAG_MS / 1000 + attempt, Math.floor(Date.now() / 1000) - 2);
    const page = await getStationSongHistory(heard.stationSlug, b - 2, Math.max(to, b - 2));
    if (!isCurrent()) return null;
    const row = pickChangeRow(page?.history ?? [], heard.startedAt, songBefore);
    if (row?.song) return row.song as ISong;
    if (attempt >= CHANGE_RETRY_DELAYS_MS.length) return null;
    await new Promise((resolve) => setTimeout(resolve, CHANGE_RETRY_DELAYS_MS[attempt]));
    if (!isCurrent()) return null;
  }
};

const updateSelectedStation = (
  stations: IStation[],
  slug: string | undefined,
  setCtx: (ctx: any) => void,
) => {
  if (!slug) return;
  const updatedStation = stations.find((s: IStation) => s.slug === slug);
  if (updatedStation) {
    setCtx({ selectedStation: updatedStation });
  }
};

export const useRefreshStations = () => {
  const { ctx, setCtx } = useContext(Context);
  const selectedStationSlug = ctx.selectedStation?.slug;

  const refreshStations = useCallback(async () => {
    try {
      const data = await getStations();
      if (data?.stations?.length > 0) {
        const stations = pinHlsNowPlaying(
          preserveLocalThumbnails(ctx.stations ?? [], data.stations),
          usePlaybackState.getState().hlsNowPlaying,
        );
        setCtx({ stations });
        if (selectedStationSlug) {
          const updatedStation = stations.find(
            (s: IStation) => s.slug === selectedStationSlug
          );
          if (updatedStation) {
            setCtx({ selectedStation: updatedStation });
          }
        }
      }
    } catch (error) {
      captureException(error, "Failed to refresh stations");
    }
  }, [selectedStationSlug, setCtx]);

  return { refreshStations };
};

const useUpdateStationsMetadata = () => {
  const { ctx, setCtx } = useContext(Context);
  const lastFetchTimestamp = useRef<number>(0);
  const lastFullRefreshTimestamp = useRef<number>(0);
  const initialFetchDone = useRef(false);
  // hlsActive / hlsPlaybackTimestamp are only ever read inside the poll
  // callbacks, so they are pulled with getState() at call time — subscribing
  // reactively re-rendered this hook's host (the island root) on every ~6s
  // FRAG_CHANGED tick just to fill a ref. hlsNowPlaying only changes once
  // per song.
  const hlsNowPlaying = usePlaybackState(s => s.hlsNowPlaying);
  /** The last song heard over HLS, per station: a history row of it dated
   *  after the next boundary is that song still running, not the change. */
  const lastHeardSongRef = useRef<{ stationId: number; songId: number } | null>(null);

  // Refs to avoid stale closures in the polling interval
  const stationsRef = useRef(ctx.stations);
  stationsRef.current = ctx.stations;
  const selectedStationSlugRef = useRef(ctx.selectedStation?.slug);
  selectedStationSlugRef.current = ctx.selectedStation?.slug;

  // Set selectedStation from URL on mount
  useEffect(() => {
    const pathSlug = window.location.pathname.replace(/^\//, "").split("/")[0];
    if (pathSlug && ctx?.stations) {
      const station = ctx.stations.find(
        (s: IStation) => s.slug === pathSlug,
      );
      if (station) {
        setCtx({ selectedStation: station });
      }
    }
  }, []);

  // The audio reached a song change announced by the HLS playlist. With the
  // playlist's song hint the title is shown at once, without a request;
  // otherwise the history API finds the row that starts at the boundary,
  // retried until it is ingested. A hint arriving meanwhile supersedes the
  // request. Nothing found leaves the station unpinned and the 10s offset
  // poll covers it.
  useEffect(() => {
    if (!hlsNowPlaying) return;
    if (hlsNowPlaying.song) {
      lastHeardSongRef.current = { stationId: hlsNowPlaying.stationId, songId: hlsNowPlaying.song.id };
      const stations = stationsRef.current;
      if (!stations?.length) return;
      const pinned = pinHlsNowPlaying(stations, hlsNowPlaying);
      if (pinned === stations) return;
      setCtx({ stations: pinned });
      updateSelectedStation(pinned, selectedStationSlugRef.current, setCtx);
      return;
    }
    const before = lastHeardSongRef.current;
    const songBefore = before?.stationId === hlsNowPlaying.stationId ? before.songId : null;
    // A newer change, a hint, a stop or a station switch supersedes this one.
    const isCurrent = () => usePlaybackState.getState().hlsNowPlaying === hlsNowPlaying;
    resolveSongChange(hlsNowPlaying, songBefore, isCurrent).then(song => {
      if (!song || !isCurrent()) return;
      usePlaybackState.getState().setHlsNowPlaying({ ...hlsNowPlaying, song });
    }).catch(() => { /* the 10s offset poll covers it */ });
  }, [hlsNowPlaying]);

  useEffect(() => {
    const doFullRefresh = async () => {
      try {
        const data = await getStations();
        if (data?.stations?.length > 0) {
          lastFetchTimestamp.current = getTimestamp();
          lastFullRefreshTimestamp.current = Date.now();
          initialFetchDone.current = true;
          // A full refresh carries the LIVE now_playing, ahead of the HLS audio.
          const stations = pinHlsNowPlaying(
            preserveLocalThumbnails(stationsRef.current ?? [], data.stations),
            usePlaybackState.getState().hlsNowPlaying,
          );
          setCtx({ stations });
          // Use selected station slug, or fall back to URL path for new stations not in build
          const slug = selectedStationSlugRef.current
            || window.location.pathname.replace(/^\//, "").split("/")[0];
          if (slug) {
            const updatedStation = stations.find(
              (s: IStation) => s.slug === slug
            );
            if (updatedStation) {
              setCtx({ selectedStation: updatedStation });
            }
          }
        }
      } catch {
        // Transient failures are silenced in getStations — only unexpected errors bubble here
      }
    };

    const fetchMetadataUpdate = async () => {
      try {
        const currentStations = stationsRef.current;
        if (!initialFetchDone.current || !currentStations?.length) return;

        // Full refresh every 5 minutes to pick up new streams
        if (Date.now() - lastFullRefreshTimestamp.current >= FULL_REFRESH_INTERVAL) {
          await doFullRefresh();
          return;
        }

        const { hlsActive, hlsPlaybackTimestamp } = usePlaybackState.getState();
        const playbackTs = hlsActive ? hlsPlaybackTimestamp : null;

        let updatedStations: IStation[];

        if (playbackTs) {
          // Dual-fetch: live (differential) + HLS playback timestamp for HLS stations.
          // The playback timestamp comes directly from the segment's EXT-X-PROGRAM-DATE-TIME,
          // so it precisely matches the audio the user is hearing.
          const [liveMetadata, offsetMetadata] = await Promise.all([
            getStationsMetadata(lastFetchTimestamp.current),
            getStationsMetadata(undefined, playbackTs),
          ]);
          lastFetchTimestamp.current = getTimestamp();

          if (!liveMetadata.length && !offsetMetadata.length) return;

          updatedStations = applyDualMetadata(stationsRef.current, liveMetadata, offsetMetadata);
        } else {
          // No HLS playing — single fetch with live timestamp
          const metadata = await getStationsMetadata(lastFetchTimestamp.current);
          lastFetchTimestamp.current = getTimestamp();

          if (!metadata.length) return;

          updatedStations = applyMetadataToStations(stationsRef.current, metadata);
        }

        updatedStations = pinHlsNowPlaying(updatedStations, usePlaybackState.getState().hlsNowPlaying);
        setCtx({ stations: updatedStations });

        const slug = selectedStationSlugRef.current;
        if (slug) {
          const updatedStation = updatedStations.find(
            (s: IStation) => s.slug === slug
          );
          if (updatedStation) {
            setCtx({ selectedStation: updatedStation });
          }
        }
      } catch {
        // On metadata fetch failure, do a full refresh to recover
        await doFullRefresh();
      }
    };

    doFullRefresh();
    const intervalId = setInterval(fetchMetadataUpdate, 10000);

    return () => clearInterval(intervalId);
  }, [setCtx]);

};

export default useUpdateStationsMetadata;
