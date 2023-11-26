"use client";

import React, { useContext } from "react";
import { IStation } from "@/models/Station";
import styles from "./styles.module.scss";
import StationItem from "@/components/StationItem";
import { Context } from "@/context/ContextProvider";
import FavoriteItem from "@/components/FavoriteItem";

const Stations = () => {
  const { ctx } = useContext(Context);

  return (
    <div
      className={styles.container}
      style={{
        visibility: ctx.isFavouriteStationsLoaded ? "visible" : "hidden",
      }}
    >
      {ctx.favouriteStations.length > 0 && (
        <div className={styles.favourite_section}>
          <h1>Favorite</h1>
          <div className={styles.stations_container}>
            {ctx.favouriteStations.map((station: IStation) => {
              return (
                <React.Fragment key={`favourite-${station.id}-${station.slug}`}>
                  <FavoriteItem {...station} />
                </React.Fragment>
              );
            })}
          </div>
          <hr />
        </div>
      )}
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
