import React, { useContext, useState, useEffect } from "react";
import Link from "next/link";

import Layout from "@/components/Layout";
import { SEO_STATISTICI } from "@/utils/seo";
import useUpdateContextMetadata from "@/hooks/useUpdateStationsMetadata";
import useFavouriteStations from "@/hooks/useFavouriteStations";
import { Context } from "@/context/ContextProvider";
import { IStation } from "@/models/Station";
import styles from "./styles.module.scss";

export default function StatisticiPage() {
  const { ctx } = useContext(Context);
  const [isLoading, setIsLoading] = useState(true);
  useUpdateContextMetadata();
  useFavouriteStations();

  useEffect(() => {
    // Check if stations are loaded
    if (ctx?.stations && ctx.stations.length > 0) {
      setIsLoading(false);
    }
  }, [ctx?.stations]);

  // Helper function to format numbers with thousand separators
  const formatNumber = (num: number): string => {
    return num.toLocaleString('ro-RO');
  };

  // Sort stations by total_listeners first, then by radio_crestin_listeners
  const sortedStations = [...(ctx?.stations || [])].sort((a: IStation, b: IStation) => {
    const aListeners = a.total_listeners || a.radio_crestin_listeners || 0;
    const bListeners = b.total_listeners || b.radio_crestin_listeners || 0;
    return bListeners - aListeners;
  });

  // Calculate total listeners using total_listeners when available
  const totalListeners = sortedStations.reduce((total: number, station: IStation) => {
    const listeners = station.total_listeners || station.radio_crestin_listeners || 0;
    return total + listeners;
  }, 0);

  // Calculate RadioCrestin specific listeners
  const radioCrestinTotal = sortedStations.reduce(
    (total: number, station: IStation) => total + (station.radio_crestin_listeners || 0),
    0
  );

  return (
    <Layout {...SEO_STATISTICI}>
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href={"/"} className={styles.logo_link}>
            <img
              src="/images/radiocrestin_logo.png"
              alt="Radio Crestin"
              width={40}
              height={40}
            />
            <span>Radio Creștin</span>
          </Link>
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
                const radioCrestinListeners = station.radio_crestin_listeners || 0;
                const displayListeners = totalListeners || radioCrestinListeners;
                
                return (
                  <Link href={station.slug} key={station.id} className={styles.station_item}>
                    <span className={styles.station_name}>{station.title}</span>
                    <div className={styles.listeners_info}>
                      <span className={styles.listeners_count}>
                        {formatNumber(displayListeners)} ascultători
                      </span>
                      {totalListeners > 0 && radioCrestinListeners > 0 && totalListeners !== radioCrestinListeners && (
                        <span className={styles.listeners_detail}>
                          ({formatNumber(radioCrestinListeners)} în RadioCrestin*)
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
