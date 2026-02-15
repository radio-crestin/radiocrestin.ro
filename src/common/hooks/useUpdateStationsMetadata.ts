import { useCallback, useContext, useEffect } from "react";
import { getStations } from "@/services/getStations";
import { IStation } from "@/models/Station";
import { Context } from "@/context/ContextProvider";
import { useRouter } from "next/router";
import { Bugsnag } from "@/utils/bugsnag";

const fetchAndUpdateStations = async (setCtx: (ctx: any) => void, selectedStationSlug?: string) => {
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

export const useRefreshStations = () => {
  const { ctx, setCtx } = useContext(Context);
  const selectedStationSlug = ctx.selectedStation?.slug;

  const refreshStations = useCallback(async () => {
    await fetchAndUpdateStations(setCtx, selectedStationSlug);
  }, [selectedStationSlug, setCtx]);

  return { refreshStations };
};

const useUpdateStationsMetadata = () => {
  const { ctx, setCtx } = useContext(Context);
  const router = useRouter();

  useEffect(() => {
    const { station_slug } = router.query;
    if (station_slug && ctx?.stations) {
      const station = ctx.stations.find(
        (s: IStation) => s.slug === station_slug,
      );
      if (station) {
        setCtx({ selectedStation: station });
      }
    }
  }, [router.query.station_slug]);

  const selectedStationSlug = ctx.selectedStation?.slug;

  useEffect(() => {
    fetchAndUpdateStations(setCtx, selectedStationSlug);
    const intervalId = setInterval(() => fetchAndUpdateStations(setCtx, selectedStationSlug), 10000);

    return () => clearInterval(intervalId);
  }, [setCtx, selectedStationSlug]);

};

export default useUpdateStationsMetadata;
