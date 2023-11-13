"use client";

import React, { Suspense, useEffect, useState } from "react";
import { IStation } from "@/models/Station";
import styles from "./styles.module.scss";
import StationItem from "@/components/StationItem";
import useStore from "@/store/useStore";

const Stations = ({ data }: { data: IStation[] }) => {
  const { isFavorite } = useStore();
  const [stations, setStations] = useState<IStation[]>(data);
  const [favouriteStations, setFavouriteStations] = useState<IStation[]>([]);

  useEffect(() => {
    const favouriteStations = stations.filter((station: IStation) => {
      return isFavorite[station.slug];
    });
    setFavouriteStations(favouriteStations);
  }, [isFavorite, stations]);

  console.log("Re-rendering Stations");

  return (
    <div className={styles.container}>
      <div>
        <h1>Favourite:</h1>
        <Suspense fallback={<div>Loading...</div>}>
          <div className={styles.stations_container}>
            {favouriteStations.map((station: IStation) => {
              return (
                <React.Fragment key={`favourite-${station.id}-${station.slug}`}>
                  <StationItem {...station} />
                </React.Fragment>
              );
            })}
          </div>
        </Suspense>
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
