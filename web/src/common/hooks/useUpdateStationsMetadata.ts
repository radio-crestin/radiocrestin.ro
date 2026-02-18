import { useCallback, useContext, useEffect, useRef } from "react";
import { getStations } from "@/services/getStations";
import { IStation } from "@/models/Station";
import { Context } from "@/context/ContextProvider";
import { Bugsnag } from "@/utils/bugsnag";

// Fetches stations and updates the list. Returns the stations array for callers
// to handle selectedStation updates with their own source of truth.
const fetchStations = async (setCtx: (ctx: any) => void) => {
  try {
    const data = await getStations();
    if (data?.stations?.length > 0) {
      setCtx({ stations: data.stations });
      return data.stations;
    }
    return null;
  } catch (error) {
    Bugsnag.notify(
      new Error(`Failed to fetch stations - error: ${JSON.stringify(error, null, 2)}`)
    );
    return null;
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
    const stations = await fetchStations(setCtx);
    if (stations) {
      updateSelectedStation(stations, selectedStationSlug, setCtx);
    }
  }, [selectedStationSlug, setCtx]);

  return { refreshStations };
};

const useUpdateStationsMetadata = () => {
  const { ctx, setCtx } = useContext(Context);
  const selectedStationSlug = ctx.selectedStation?.slug;
  const selectedStationSlugRef = useRef(selectedStationSlug);

  // Keep the ref in sync so polling always uses the latest slug
  useEffect(() => {
    selectedStationSlugRef.current = selectedStationSlug;
  }, [selectedStationSlug]);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const stations = await fetchStations(setCtx);
      // Read the ref AFTER the await — this is the user's latest selection,
      // not the stale value from when the poll started
      if (cancelled || !stations) return;
      updateSelectedStation(stations, selectedStationSlugRef.current, setCtx);
    };

    poll();
    const intervalId = setInterval(poll, 10000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [setCtx]);

};

export default useUpdateStationsMetadata;
