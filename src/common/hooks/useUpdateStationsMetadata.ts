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
      setCtx({
        selectedStation: ctx.stations.find(
          (s: IStation) => s.slug === station_slug,
        ),
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
