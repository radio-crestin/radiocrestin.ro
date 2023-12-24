"use client";

import React, { useContext, useEffect, useState } from "react";
import { IStation } from "@/models/Station";
import styles from "./styles.module.scss";
import { Context } from "@/context/ContextProvider";
import FavoriteItem from "@/components/FavoriteItem";
import StationItem from "@/components/StationItem";
import { Magnify } from "@/icons/Magnify";
import CloseIcon from "@/icons/CloseIcon";

const Stations = () => {
  const { ctx } = useContext(Context);
  const [filteredStations, setFilteredStations] = useState(ctx.stations);
  const [searchedValue, setSearchedValue] = useState("");

  useEffect(() => {
    if (searchedValue) {
      handleSearch();
    } else {
      setFilteredStations(ctx.stations);
    }
  }, [ctx.stations]);

  useEffect(() => {
    handleSearch();
  }, [searchedValue]);

  const handleSearch = () => {
    let newFilteredStations = [];
    // Filter by station title
    newFilteredStations.push(
      ...ctx.stations.filter((station: IStation) =>
        station.title.toLowerCase().includes(searchedValue),
      ),
    );

    // Filter by song name
    newFilteredStations.push(
      ...ctx.stations.filter(
        (station: IStation) =>
          station.now_playing?.song?.name.toLowerCase().includes(searchedValue),
      ),
    );

    // Filter by artist name
    newFilteredStations.push(
      ...ctx.stations.filter(
        (station: IStation) =>
          station.now_playing?.song?.artist?.name
            .toLowerCase()
            .includes(searchedValue),
      ),
    );

    // Remove duplicates
    newFilteredStations = newFilteredStations.filter(
      (station, index, self) =>
        index ===
        self.findIndex((t) => t.id === station.id && t.slug === station.slug),
    );

    setFilteredStations(newFilteredStations);
  };

  const handleKeyPress = (event: any) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.target.blur(); // Remove focus from the input to close the keyboard
    }
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
            value={searchedValue}
            onChange={(e) => setSearchedValue(e.target.value.toLowerCase())}
            onKeyDown={handleKeyPress}
          />
          {searchedValue ? (
            <CloseIcon
              className={styles.icon}
              width={20}
              height={20}
              onClick={() => setSearchedValue("")}
            />
          ) : (
            <Magnify className={styles.icon} width={20} />
          )}
        </div>
      </div>
      <div className={styles.stations_container}>
        {filteredStations.length === 0 ? (
          <div className={styles.no_results}>
            <h1>
              Nu am găsit niciun rezultat cu denumirea:{" "}
              <strong>{searchedValue}</strong>.
            </h1>
          </div>
        ) : (
          filteredStations.map((station: IStation) => (
            <React.Fragment key={`${station.id}-${station.slug}`}>
              <StationItem {...station} />
            </React.Fragment>
          ))
        )}
      </div>
    </div>
  );
};

export default Stations;
