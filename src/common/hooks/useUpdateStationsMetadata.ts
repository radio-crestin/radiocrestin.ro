import { useContext, useEffect } from "react";
import { getStations } from "@/services/getStations";
import { IStation } from "@/models/Station";
import { Context } from "@/context/ContextProvider";
import { useRouter } from "next/router";
import { Bugsnag } from "@/utils/bugsnag";

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
    const fetchStationsData = async () => {
      try {
        const data = await getStations();
        if (data?.stations && data?.stations.length > 0) {
          setCtx({
            stations: data.stations,
          });
        }
      } catch (error) {
        Bugsnag.notify(
          new Error(
            `Failed to fetch stations - error: ${JSON.stringify(
              error,
              null,
              2,
            )}`,
          ),
        );
      }
    };

    fetchStationsData();
    const intervalId = setInterval(fetchStationsData, 10000);

    return () => clearInterval(intervalId);
  }, []);
};

export default useUpdateStationsMetadata;
