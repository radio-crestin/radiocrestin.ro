import React, { useContext } from "react";
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
  useUpdateContextMetadata();
  useFavouriteStations();

  const sortedStations = [...(ctx?.stations || [])].sort(
    (a: IStation, b: IStation) =>
      b.radio_crestin_listeners - a.radio_crestin_listeners,
  );

  const totalListeners = sortedStations.reduce(
    (total: number, station: IStation) =>
      total + station.radio_crestin_listeners,
    0,
  );

  return (
    <Layout {...SEO_STATISTICI}>
      <div className={styles.container}>
        <div className={styles.all_stations}>
          <Link href={"/"} className={styles.back_link}>
            <span>←</span> Inapoi
          </Link>
          {sortedStations.map((station: IStation) => (
            <Link href={station.slug} key={station.id} className={styles.station_item}>
              <span className={styles.station_name}>{station.title}</span>
              <span className={styles.listeners_count}>
                {station.radio_crestin_listeners || 0} ascultători
              </span>
            </Link>
          ))}
          <div className={styles.total_listeners}>
            🎧 Total Ascultători: {totalListeners}
          </div>
          <p className={styles.info_text}>
            (radio-crestin.com / radiocrestin.ro / Radio Crestin mobile apps)
          </p>
        </div>
      </div>
    </Layout>
  );
}
