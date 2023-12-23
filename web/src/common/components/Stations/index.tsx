"use client";

import React, { useContext, useEffect, useState } from "react";
import { IStation } from "@/models/Station";
import styles from "./styles.module.scss";
import { Context } from "@/context/ContextProvider";
import FavoriteItem from "@/components/FavoriteItem";
import StationItem from "@/components/StationItem";
import { Magnify } from "@/icons/Magnify";

const Stations = () => {
  const { ctx } = useContext(Context);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredStations, setFilteredStations] = useState(ctx.stations);

  useEffect(() => {
    if (searchTerm) {
      setFilteredStations(
        ctx.stations.filter((station: IStation) =>
          station.title.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      );
    } else {
      setFilteredStations(ctx.stations);
    }
  }, [ctx.stations]);

  const handleSearch = () => {
    setFilteredStations(
      ctx.stations.filter((station: IStation) =>
        station.title.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    );
  };

  return (
    <div
      className={styles.container}
      style={{
        visibility: ctx.isFavouriteStationsLoaded ? "visible" : "hidden",
      }}
    >
      {ctx.favouriteStations.length > 0 && (
        <div className={styles.favourite_section}>
          <h1>⭐ Favorite</h1>
          <div className={styles.stations_container}>
            {ctx.favouriteStations.map((station: IStation) => {
              return (
                <React.Fragment key={`favourite-${station.id}-${station.slug}`}>
                  <FavoriteItem {...station} />
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
      <div className={`${styles.search_section}`}>
        <div className={`${styles.search_container}`}>
          <input
            type="text"
            placeholder="Caută un radio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
          />
          <Magnify className={styles.icon} onClick={handleSearch} width={20} />
        </div>
      </div>
      <div className={styles.stations_container}>
        {filteredStations.map((station: IStation) => (
          <React.Fragment key={`${station.id}-${station.slug}`}>
            <StationItem {...station} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default Stations;
