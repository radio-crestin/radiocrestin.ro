import { getStations } from "@/services/getStations";
import { IStation } from "@/models/Station";
import React from "react";
import { cleanStationsMetadata } from "@/utils/cleanStationsMetadata";
import Stations from "@/components/Stations";
import styles from "./styles.module.scss";

export default function StationPage({
  stations_BE,
}: {
  stations_BE: IStation[];
}) {
  return (
    <div className={styles.container}>
      <Stations data={stations_BE} />
    </div>
  );
}

export async function getStaticPaths() {
  const { stations } = await getStations();

  // Generate the paths for each station
  const paths = stations.map((station: IStation) => ({
    params: { station_slug: station.slug },
  }));

  return {
    paths,
    fallback: false,
  };
}

export async function getStaticProps(context: any) {
  const { stations } = await getStations();

  stations.forEach((station: IStation) => {
    station.is_favorite = false;
  });

  const { station_slug } = context.params;
  const stationData = stations.find(
    (station: IStation) => station.slug === station_slug,
  );
  const stations_without_meta = cleanStationsMetadata(stations);

  if (!stationData) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      stations_BE: stations_without_meta,
      station_slug,
    },
  };
}
