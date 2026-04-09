import { useCallback, useContext, useEffect, useRef } from "react";
import { getStations, getStationsMetadata } from "@/services/getStations";
import type { IStationMetadata } from "@/services/getStations";
import type { IStation } from "@/models/Station";
import { Context } from "@/context/ContextProvider";
import { captureException } from "@/utils/posthog";

const FULL_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

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

  useEffect(() => {
    const doFullRefresh = async () => {
      try {
        const data = await getStations();
        if (data?.stations?.length > 0) {
          lastFetchTimestamp.current = Math.floor(Date.now() / 10000) * 10;
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

        const metadata = await getStationsMetadata(lastFetchTimestamp.current);
        lastFetchTimestamp.current = Math.floor(Date.now() / 10000) * 10;

        if (metadata.length > 0) {
          const updatedStations = applyMetadataToStations(stationsRef.current, metadata);
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
