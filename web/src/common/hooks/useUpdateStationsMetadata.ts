import { useCallback, useContext, useEffect, useRef } from "react";
import { getStations, getStationsMetadata } from "@/services/getStations";
import type { IStationMetadata } from "@/services/getStations";
import type { IStation } from "@/models/Station";
import { Context } from "@/context/ContextProvider";
import { captureException } from "@/utils/posthog";
import usePlaybackState from "@/store/usePlaybackState";

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

const applyMetadataToStations = (stations: IStation[], metadata: IStationMetadata[]): IStation[] => {
  if (!metadata.length) return stations;

  const metadataMap = new Map(metadata.map(m => [m.id, m]));

  return stations.map(station => {
    const meta = metadataMap.get(station.id);
    if (!meta) return station;
    return deepMerge(station, meta);
  });
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

  return stations.map(station => {
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

    return merged;
  });
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
        setCtx({ stations: data.stations });
        if (selectedStationSlug) {
          const updatedStation = data.stations.find(
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
  const hlsActive = usePlaybackState(s => s.hlsActive);
  const hlsActiveRef = useRef(hlsActive);
  hlsActiveRef.current = hlsActive;
  const hlsPlaybackTimestamp = usePlaybackState(s => s.hlsPlaybackTimestamp);
  const hlsPlaybackTimestampRef = useRef(hlsPlaybackTimestamp);
  hlsPlaybackTimestampRef.current = hlsPlaybackTimestamp;
  const hlsSongId = usePlaybackState(s => s.hlsSongId);
  /** The song_id we last triggered an immediate fetch for — prevents re-fetching. */
  const lastFetchedHlsSongIdRef = useRef<number | null>(null);

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

  // Immediate metadata refetch when HLS ID3 detects a song change.
  // Fires ONCE per new hlsSongId — after that the regular 10s poll takes over.
  useEffect(() => {
    if (
      hlsSongId == null ||
      hlsSongId === lastFetchedHlsSongIdRef.current ||
      !initialFetchDone.current
    ) return;

    // Check if the displayed song already matches — no fetch needed
    const displayedSongId = ctx.selectedStation?.now_playing?.song?.id;
    if (displayedSongId === hlsSongId) {
      lastFetchedHlsSongIdRef.current = hlsSongId;
      return;
    }

    lastFetchedHlsSongIdRef.current = hlsSongId;

    // Fire-and-forget immediate metadata fetch with the HLS playback timestamp
    const playbackTs = hlsPlaybackTimestampRef.current;
    getStationsMetadata(undefined, playbackTs ?? undefined).then(metadata => {
      if (!metadata.length) return;
      const stations = stationsRef.current;
      if (!stations?.length) return;
      const updatedStations = applyMetadataToStations(stations, metadata);
      setCtx({ stations: updatedStations });
      const slug = selectedStationSlugRef.current;
      if (slug) {
        const updatedStation = updatedStations.find((s: IStation) => s.slug === slug);
        if (updatedStation) setCtx({ selectedStation: updatedStation });
      }
    }).catch(() => { /* next poll will catch up */ });
  }, [hlsSongId]);

  useEffect(() => {
    const doFullRefresh = async () => {
      try {
        const data = await getStations();
        if (data?.stations?.length > 0) {
          lastFetchTimestamp.current = getTimestamp();
          lastFullRefreshTimestamp.current = Date.now();
          initialFetchDone.current = true;
          setCtx({ stations: data.stations });
          // Use selected station slug, or fall back to URL path for new stations not in build
          const slug = selectedStationSlugRef.current
            || window.location.pathname.replace(/^\//, "").split("/")[0];
          if (slug) {
            const updatedStation = data.stations.find(
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

        const playbackTs = hlsActiveRef.current ? hlsPlaybackTimestampRef.current : null;

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
