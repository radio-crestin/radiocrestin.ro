"use client";

import React, { useEffect, useState } from "react";
import { IStation } from "@/models/Station";
import styles from "./styles.module.scss";
import StationItem from "@/components/StationItem";
import useStore from "@/store/useStore";

const Stations = ({ stations }: { stations: IStation[] }) => {
  const [isFavLoaded, setIsFavLoaded] = useState<boolean>(false);
  const { favouriteItems } = useStore();
  const [favouriteStations, setFavouriteStations] = useState<IStation[]>([]);

  useEffect(() => {
    const favouriteStations: Array<IStation | any> =
      favouriteItems.map((slug: string) => {
        return stations.find((station: IStation) => station.slug === slug);
      }) || [];
    setFavouriteStations(favouriteStations);
    setIsFavLoaded(true);
  }, [favouriteItems, stations]);

  return (
    <div
      className={styles.container}
      style={{ visibility: isFavLoaded ? "visible" : "hidden" }}
    >
      <div>
        <h1>Favourite:</h1>
        <div className={styles.stations_container}>
          {favouriteStations.map((station: IStation) => {
            return (
              <React.Fragment key={`favourite-${station.id}-${station.slug}`}>
                <StationItem {...station} />
              </React.Fragment>
            );
          })}
        </div>
      </div>

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
};

export default Stations;
