import { useCallback, useContext, useEffect } from "react";
import { getStations } from "@/services/getStations";
import { IStation } from "@/models/Station";
import { Context } from "@/context/ContextProvider";
import { useRouter } from "next/router";
import { Bugsnag } from "@/utils/bugsnag";

const fetchAndUpdateStations = async (setCtx: (ctx: any) => void) => {
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

export const useRefreshStations = () => {
  const { ctx, setCtx } = useContext(Context);
  const selectedStationSlug = ctx.selectedStation?.slug;

  const refreshStations = useCallback(async () => {
    const stations = await fetchAndUpdateStations(setCtx);
    if (stations && selectedStationSlug) {
      const updatedStation = stations.find(
        (s: IStation) => s.slug === selectedStationSlug
      );
      if (updatedStation) {
        setCtx({ selectedStation: updatedStation });
      }
    }
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

  useEffect(() => {
    fetchAndUpdateStations(setCtx);
    const intervalId = setInterval(() => fetchAndUpdateStations(setCtx), 10000);

    return () => clearInterval(intervalId);
  }, [setCtx]);

  useEffect(() => {
    if (ctx.selectedStation?.title) {
      document.title = `${ctx.selectedStation.title} | Caută şi ascultă Radiouri Creştine online`;
    }
  }, [ctx.selectedStation?.slug]);
};

export default useUpdateStationsMetadata;
