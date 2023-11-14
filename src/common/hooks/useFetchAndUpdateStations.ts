import { useEffect, useState } from "react";
import { getStations } from "@/services/getStations";
import { IStation } from "@/models/Station";

const useFetchAndUpdateStations = (initialStations: IStation[]) => {
  const [stations, setStations] = useState(initialStations);

  useEffect(() => {
    const fetchStationsData = async () => {
      try {
        const data = await getStations();
        if (data?.stations && data?.stations.length > 0) {
          setStations(data.stations);
        }
      } catch (error) {
        console.error("Failed to fetch stations:", error);
      }
    };

    fetchStationsData();
    const intervalId = setInterval(fetchStationsData, 10000);

    return () => clearInterval(intervalId);
  }, []);

  return stations;
};

export default useFetchAndUpdateStations;
