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
  const selectedStationId = ctx.selectedStation?.id;

  const refreshStations = useCallback(async () => {
    const stations = await fetchAndUpdateStations(setCtx);
    if (stations && selectedStationId) {
      const updatedStation = stations.find(
        (s: IStation) => s.id === selectedStationId
      );
      if (updatedStation) {
        setCtx({ selectedStation: updatedStation });
      }
    }
  }, [selectedStationId, setCtx]);

  return { refreshStations };
};

const useUpdateStationsMetadata = () => {
  const { ctx, setCtx } = useContext(Context);
  const router = useRouter();

  useEffect(() => {
    const { station_slug } = router.query;
    if (station_slug && ctx?.stations) {
      const selectedStationIndex = ctx.stations.findIndex(
        (s: IStation) => s.slug === station_slug,
      );

      setCtx({
        selectedStation: ctx.stations[selectedStationIndex],
      });
    }
  }, [router.query.station_slug, ctx.stations]);

  useEffect(() => {
    fetchAndUpdateStations(setCtx);
    const intervalId = setInterval(() => fetchAndUpdateStations(setCtx), 10000);

    return () => clearInterval(intervalId);
  }, [setCtx]);
};

export default useUpdateStationsMetadata;
