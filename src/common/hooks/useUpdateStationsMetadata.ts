import { useContext, useEffect } from "react";
import { getStations } from "@/services/getStations";
import { IStation } from "@/models/Station";
import { Context } from "@/context/ContextProvider";
import { useRouter } from "next/router";

const useUpdateStationsMetadata = () => {
  const { ctx, setCtx } = useContext(Context);
  const router = useRouter();

  useEffect(() => {
    const { station_slug } = router.query;
    if (station_slug && ctx?.stations) {
      const selectedStationIndex = ctx.stations.findIndex(
        (s: IStation) => s.slug === station_slug,
      );

      // Calculate next stations with wrap around
      let nextStations = [];
      for (let i = 1; i <= 3; i++) {
        nextStations.push(
          ctx.stations[(selectedStationIndex + i) % ctx.stations.length],
        );
      }

      setCtx({
        selectedStation: ctx.stations[selectedStationIndex],
        nextStations,
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
        console.error("Failed to fetch stations:", error);
      }
    };

    fetchStationsData();
    const intervalId = setInterval(fetchStationsData, 10000);

    return () => clearInterval(intervalId);
  }, []);
};

export default useUpdateStationsMetadata;
