import { getStations } from "@/services/getStations";
import { IStation } from "@/models/Station";
import React from "react";
import styles from "./styles.module.scss";
import Stations from "@/components/Stations";

export async function generateStaticParams() {
  const { stations } = await getStations();

  // TODO: Btw, you should use cleanStationsMetadata() function to remove unnecessary data from stations and have a fresh stations data

  return stations.map((station: IStation) => {
    return { station_slug: station.slug };
  });
}

export default async function Page({
  params,
}: {
  params: { station_slug: string };
}) {
  const { station_slug } = params;

  const { stations } = await getStations();

  // Add isFavourite property to each station
  stations.forEach((station: IStation) => {
    station.is_favorite = false;
  });

  const currentStation = stations.find(
    (station: IStation) => station.slug === station_slug,
  );

  return (
    <div className={styles.container}>
      <Stations data={stations} />
    </div>
  );
}
