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
        <Link href={"/"}> 🔙 Inapoi</Link>
        <div className={styles.all_stations}>
          {sortedStations.map((station: IStation) => (
            <Link href={station.slug} key={station.id}>
              {station.title} - {station.radio_crestin_listeners || 0}
            </Link>
          ))}
          <div className={styles.total_listeners}>
            ------------------------
            <br />
            🎧 Total Listeners: {totalListeners}
          </div>
          <p>
            (radio-crestin.com / radiocrestin.ro / Radio Crestin mobile apps)
          </p>
        </div>
      </div>
    </Layout>
  );
}
