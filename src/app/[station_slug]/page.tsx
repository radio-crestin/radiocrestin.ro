import { getStations } from "@/services/getStations";
import { IStation } from "@/models/Station";
import StationItem from "@/components/StationItem";
import React from "react";
import styles from "./styles.module.scss";

export async function generateStaticParams() {
  const { stations } = await getStations();

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
  const currentStation = stations.find(
    (station: IStation) => station.slug === station_slug,
  );

  return (
    <div className={styles.container}>
      <div className={styles.stations_container}>
        {stations.map((station: IStation) => {
          return (
            <React.Fragment key={`${station.id}-${station.slug}`}>
              <StationItem {...station} />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
