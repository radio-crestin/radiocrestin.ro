"use client";

import React, { useContext } from "react";
import { IStation } from "@/models/Station";
import styles from "./styles.module.scss";
import StationItem from "@/components/StationItem";
import { Context } from "@/context/ContextProvider";

const Stations = () => {
  const { ctx } = useContext(Context);

  return (
    <div
      className={styles.container}
      style={{
        visibility: ctx.isFavouriteStationsLoaded ? "visible" : "hidden",
      }}
    >
      <div>
        <h1>Favourite:</h1>
        <div className={styles.stations_container}>
          {ctx.favouriteStations.map((station: IStation) => {
            return (
              <React.Fragment key={`favourite-${station.id}-${station.slug}`}>
                <StationItem {...station} />
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className={styles.stations_container}>
        {ctx.stations.map((station: IStation) => {
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
