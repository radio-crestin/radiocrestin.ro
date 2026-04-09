import React, { useContext, useState, useEffect } from "react";
import { ContextProvider, Context } from "@/context/ContextProvider";
import { ToastContainer } from "react-toastify";
import NoInternetConnection from "@/components/NoInternetConnection";
import useUpdateContextMetadata from "@/hooks/useUpdateStationsMetadata";
import useFavouriteStations from "@/hooks/useFavouriteStations";
import type { IStation } from "@/models/Station";
import { initPostHog } from "@/utils/posthog";
import styles from "../../pages/statistici/styles.module.scss";

function StatisticiContent() {
  const { ctx } = useContext(Context);
  const [isLoading, setIsLoading] = useState(true);
  useUpdateContextMetadata();
  useFavouriteStations();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (ctx?.stations && ctx.stations.length > 0) {
      setIsLoading(false);
    }
  }, [ctx?.stations]);

  const formatNumber = (num: number): string => {
    return num.toLocaleString("ro-RO");
  };

  const sortedStations = [...(ctx?.stations || [])].sort(
    (a: IStation, b: IStation) => {
      const aListeners = a.total_listeners || a.radio_crestin_listeners || 0;
      const bListeners = b.total_listeners || b.radio_crestin_listeners || 0;
      return bListeners - aListeners;
    }
  );

  const totalListeners = sortedStations.reduce(
    (total: number, station: IStation) => {
      const listeners =
        station.total_listeners || station.radio_crestin_listeners || 0;
      return total + listeners;
    },
    0
  );

  const radioCrestinTotal = sortedStations.reduce(
    (total: number, station: IStation) =>
      total + (station.radio_crestin_listeners || 0),
    0
  );

  return (
    <NoInternetConnection>
      <div className={styles.container}>
        <div className={styles.header}>
          <a href={"/"} className={styles.logo_link}>
            <img
              src="/images/radiocrestin_logo.png"
              alt="Radio Crestin"
              width={40}
              height={40}
            />
            <span>Radio Creștin</span>
          </a>
        </div>

        {isLoading ? (
          <div className={styles.loading_container}>
            <div className={styles.loading_spinner}></div>
          </div>
        ) : (
          <div className={styles.all_stations}>
            <div className={styles.total_listeners}>
              🎧 Total Ascultători: {formatNumber(totalListeners)}
              {totalListeners !== radioCrestinTotal && (
                <div className={styles.total_detail}>
                  ({formatNumber(radioCrestinTotal)} în RadioCrestin*)
                </div>
              )}
            </div>
            <p className={styles.info_text}>
              RadioCrestin* ➔ radiocrestin.ro + Radio Crestin Android/iOS
            </p>

            <div className={styles.stations_list}>
              {sortedStations.map((station: IStation) => {
                const totalListeners = station.total_listeners || 0;
                const radioCrestinListeners =
                  station.radio_crestin_listeners || 0;
                const displayListeners =
                  totalListeners || radioCrestinListeners;

                return (
                  <a
                    href={station.slug}
                    key={station.id}
                    className={styles.station_item}
                  >
                    <span className={styles.station_name}>
                      {station.title}
                    </span>
                    <div className={styles.listeners_info}>
                      <span className={styles.listeners_count}>
                        {formatNumber(displayListeners)} ascultători
                      </span>
                      {totalListeners > 0 &&
                        radioCrestinListeners > 0 &&
                        totalListeners !== radioCrestinListeners && (
                          <span className={styles.listeners_detail}>
                            ({formatNumber(radioCrestinListeners)} în
                            RadioCrestin*)
                          </span>
                        )}
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <ToastContainer />
    </NoInternetConnection>
  );
}

export default function StatisticiApp({
  stations,
}: {
  stations: IStation[];
}) {
  return (
    <ContextProvider
      initialState={{ stations, favouriteStations: [] }}
    >
      <StatisticiContent />
    </ContextProvider>
  );
}
