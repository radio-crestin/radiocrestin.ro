"use client";

import React, { useEffect, useState, useCallback } from "react";
import { IStationExtended } from "@/common/models/Station";
import styles from "./styles.module.scss";
import FavoriteItem from "@/common/components/FavoriteItem/FavoriteItem";
import StationItem from "@/common/components/StationItem/StationItem";
import { Magnify } from "@/icons/Magnify";
import CloseIcon from "@/icons/CloseIcon";
import WhatsAppBibleGroup from "@/common/components/WhatsAppBibleGroup/WhatsAppBibleGroup";
import useFavourite from "@/common/store/useFavourite";
import { useStationsData } from "@/common/hooks/useStationsData";
import { useSelectedStation } from "@/common/providers/SelectedStationProvider";

interface StationsProps {
  stations: IStationExtended[];
}

const Stations = ({ stations: propStations }: StationsProps) => {
  const { favouriteItems } = useFavourite();
  
  // Try to use context, but handle the case where we're outside the provider
  let contextStations: IStationExtended[] = [];
  try {
    const context = useSelectedStation();
    contextStations = context.stations;
  } catch (error) {
    // We're outside the provider, which is fine for the home page
  }
  
  // Use context stations if available, otherwise fall back to prop
  const stations = contextStations.length > 0 ? contextStations : propStations;
  
  const [filteredStations, setFilteredStations] = useState(stations);
  const [searchedValue, setSearchedValue] = useState("");

  const favouriteStations = stations.filter(station =>
    favouriteItems.includes(station.slug)
  );


  const handleSearch = useCallback(() => {
    let newFilteredStations = [];
    // Filter by station title
    newFilteredStations.push(
        ...stations.filter((station: IStationExtended) =>
            station.title.toLowerCase().includes(searchedValue),
        ),
    );

    // Filter by song name
    newFilteredStations.push(
        ...stations.filter((station: IStationExtended) =>
            station.now_playing?.song?.name.toLowerCase().includes(searchedValue),
        ),
    );

    // Filter by artist name
    newFilteredStations.push(
        ...stations.filter((station: IStationExtended) =>
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
  }, [searchedValue, stations]);

  useEffect(() => {
    if (searchedValue) {
      handleSearch();
    } else {
      setFilteredStations(stations);
    }
  }, [searchedValue, stations, handleSearch]);


  useEffect(() => {
    if (
      favouriteStations.length > 0 &&
      document.getElementsByClassName("apasa_aici_move").length > 0
    ) {
      document.getElementsByClassName("apasa_aici_move")[0].remove();
      let favouriteSection: any = document.querySelectorAll(
        '[data-info="favourite-section"]',
      );
      let scrollPosition = favouriteSection[0].offsetTop - 100;
      window.scrollTo({ top: scrollPosition, behavior: "smooth" });
    }
  }, [favouriteStations]);

  useEffect(() => {
    handleSearch();
  }, [searchedValue, handleSearch]);


  const handleKeyPress = (event: any) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.target.blur(); // Remove focus from the input to close the keyboard
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
      <WhatsAppBibleGroup />
      <div className={styles.favourite_section} data-info={"favourite-section"}>
        <h1>Stații favorite:</h1>
        {favouriteStations.length > 0 ? (
          <div className={styles.stations_container}>
            {favouriteStations.map((station: IStationExtended) => {
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
          filteredStations.map((station: IStationExtended) => (
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
