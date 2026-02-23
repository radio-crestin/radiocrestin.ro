import { useCallback, useContext, useEffect, useRef } from "react";
import { getStations, getStationsMetadata, IStationMetadata } from "@/services/getStations";
import { IStation } from "@/models/Station";
import { Context } from "@/context/ContextProvider";
import { useRouter } from "next/router";
import { Bugsnag } from "@/utils/bugsnag";

const applyMetadataToStations = (stations: IStation[], metadata: IStationMetadata[]): IStation[] => {
  if (!metadata.length) return stations;

  const metadataMap = new Map(metadata.map(m => [m.id, m]));

  return stations.map(station => {
    const meta = metadataMap.get(station.id);
    if (!meta) return station;
    return { ...station, ...meta };
  });
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
      Bugsnag.notify(
        new Error(`Failed to refresh stations - error: ${JSON.stringify(error, null, 2)}`)
      );
    }
  }, [selectedStationSlug, setCtx]);

  return { refreshStations };
};

const useUpdateStationsMetadata = () => {
  const { ctx, setCtx } = useContext(Context);
  const router = useRouter();
  const lastFetchTimestamp = useRef<number>(0);
  const initialFetchDone = useRef(false);

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
    const fetchInitialStations = async () => {
      try {
        const data = await getStations();
        if (data?.stations?.length > 0) {
          lastFetchTimestamp.current = Math.floor(Date.now() / 10000) * 10;
          initialFetchDone.current = true;
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
        Bugsnag.notify(
          new Error(`Failed to fetch stations - error: ${JSON.stringify(error, null, 2)}`)
        );
      }
    };

    const fetchMetadataUpdate = async () => {
      try {
        if (!initialFetchDone.current || !ctx.stations?.length) return;

        const metadata = await getStationsMetadata(lastFetchTimestamp.current);
        lastFetchTimestamp.current = Math.floor(Date.now() / 10000) * 10;

        if (metadata.length > 0) {
          const updatedStations = applyMetadataToStations(ctx.stations, metadata);
          setCtx({ stations: updatedStations });

          if (selectedStationSlug) {
            const updatedStation = updatedStations.find(
              (s: IStation) => s.slug === selectedStationSlug
            );
            if (updatedStation) {
              setCtx({ selectedStation: updatedStation });
            }
          }
        }
      } catch (error) {
        Bugsnag.notify(
          new Error(`Failed to fetch stations metadata - error: ${JSON.stringify(error, null, 2)}`)
        );
      }
    };

    fetchInitialStations();
    const intervalId = setInterval(fetchMetadataUpdate, 10000);

    return () => clearInterval(intervalId);
  }, [setCtx, selectedStationSlug]);

};

export default useUpdateStationsMetadata;
