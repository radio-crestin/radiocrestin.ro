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
  const [filteredStations, setFilteredStations] = useState(ctx.stations || []);
  const [searchedValue, setSearchedValue] = useState("");

  useEffect(() => {
    if (searchedValue) {
      handleSearch();
    } else {
      setFilteredStations(ctx.stations || []);
    }
  }, [ctx.stations]);

  useEffect(() => {
    if (
      ctx.favouriteStations?.length > 0 &&
      document.getElementsByClassName("apasa_aici_move").length > 0
    ) {
      document.getElementsByClassName("apasa_aici_move")[0].remove();
      let favouriteSection: any = document.querySelectorAll(
        '[data-info="favourite-section"]',
      );
      let scrollPosition = favouriteSection[0].offsetTop - 100;
      window.scrollTo({ top: scrollPosition, behavior: "smooth" });
    }
  }, [ctx.favouriteStations]);

  useEffect(() => {
    handleSearch();
  }, [searchedValue]);

  const handleSearch = () => {
    let newFilteredStations = [];
    // Filter by station title
    newFilteredStations.push(
      ...(ctx.stations || []).filter((station: IStation) =>
        station.title.toLowerCase().includes(searchedValue),
      ),
    );

    // Filter by song name
    newFilteredStations.push(
      ...(ctx.stations || []).filter((station: IStation) =>
        station.now_playing?.song?.name?.toLowerCase().includes(searchedValue),
      ),
    );

    // Filter by artist name
    newFilteredStations.push(
      ...(ctx.stations || []).filter((station: IStation) =>
        station.now_playing?.song?.artist?.name
          ?.toLowerCase()
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
    }
  };

  function handleNoStationClicked() {
    let stationItems = document.querySelectorAll(
      '[data-station="station-item"]',
    );

    stationItems[1].scrollIntoView({ behavior: "smooth" });

    if (!document.querySelector(".apasa_aici_move")) {
      let newElement = document.createElement("div");
      newElement.className = "apasa_aici_move";
      newElement.innerHTML =
        'Apasa aici <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 25"><path style="fill:#161616FF" d="m17.5 5.999-.707.707 5.293 5.293H1v1h21.086l-5.294 5.295.707.707L24 12.499l-6.5-6.5z" data-name="Right"/></svg>';
      stationItems[2].appendChild(newElement);

      setTimeout(() => {
        newElement.remove();
      }, 10000);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.favourite_section} data-info={"favourite-section"}>
        <h2>Stații favorite:</h2>
        {ctx.favouriteStations?.length > 0 ? (
          <div className={styles.stations_container}>
            {ctx.favouriteStations.map((station: IStation) => {
              return (
                <React.Fragment key={`favourite-${station.id}-${station.slug}`}>
                  <FavoriteItem {...station} />
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div
            className={`${styles.stations_container} ${styles.favourite_cont}`}
          >
            <div className={styles.favorite_card}>
              <img src="./icons/diamond.svg" alt="Diamond icon" height={24} />
              <p>
                Adaugă un radio în lista de favorite pentru a-l accesa mai ușor.
              </p>
              <button
                onClick={() => handleNoStationClicked()}
                aria-label="Add to favourite"
              >
                Adaugă
              </button>
            </div>
          </div>
        )}
      </div>
      <div className={`${styles.search_section}`}>
        <div className={`${styles.search_container}`}>
          <input
            id="station-search"
            name="station-search"
            type="text"
            placeholder="Caută un radio..."
            value={searchedValue}
            onChange={(e) => setSearchedValue(e.target.value.toLowerCase())}
            onKeyDown={handleKeyPress}
            aria-label="Search a station"
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
            Nu am găsit niciun rezultat cu denumirea:{" "}
            <strong>{searchedValue}</strong>.
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
