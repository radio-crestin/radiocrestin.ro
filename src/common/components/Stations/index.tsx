"use client";

import React, { useContext, useEffect, useState } from "react";
import { IStation } from "@/models/Station";
import { Context } from "@/context/ContextProvider";
import FavoriteItem from "@/components/FavoriteItem";
import StationItem from "@/components/StationItem";
import { Magnify } from "@/icons/Magnify";
import CloseIcon from "@/icons/CloseIcon";
import WhatsAppBibleGroup from "@/components/WhatsAppBibleGroup";

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
    <div className="flex flex-col items-center">
      <WhatsAppBibleGroup />
      <div className="max-w-6xl w-full mx-auto xl:w-[calc(100%-30px)] xl:px-4 xl:mb-2.5" data-info={"favourite-section"}>
        <h1 className="mt-12 mx-auto mb-4 text-2xl font-bold text-foreground">Stații favorite:</h1>
        {ctx.favouriteStations?.length > 0 ? (
          <div className="flex flex-row flex-wrap gap-5 max-w-6xl mt-8 mx-auto w-full">
            {ctx.favouriteStations.map((station: IStation) => {
              return (
                <React.Fragment key={`favourite-${station.id}-${station.slug}`}>
                  <FavoriteItem {...station} />
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-row flex-wrap gap-5 max-w-6xl mt-8 mx-auto w-full">
            <div className="flex max-w-xl gap-2 w-full p-4 px-6 relative text-base leading-6 bg-background-favorite border border-yellow-500 rounded-xl items-center md:ml-0">
              <img src="./icons/diamond.svg" alt="Diamond icon" height={24} />
              <p className="text-foreground text-base max-w-sm mr-auto">
                Adaugă un radio în lista de favorite pentru a-l accesa mai ușor.
              </p>
              <button
                onClick={() => handleNoStationClicked()}
                aria-label="Add to favourite"
                className="px-2.5 py-2.5 cursor-pointer bg-yellow-500 text-white border-0 rounded-md font-bold"
              >
                Adaugă
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end max-w-6xl mx-auto mb-0 w-full gap-2.5 lg:w-auto lg:mr-6 md:mr-4">
        <div className="flex border border-gray-500 rounded-full max-w-xs w-full mt-6 hover:max-w-sm focus-within:max-w-sm bg-background-search">
          <input
            type="text"
            placeholder="Caută un radio..."
            value={searchedValue}
            onChange={(e) => setSearchedValue(e.target.value.toLowerCase())}
            onKeyDown={handleKeyPress}
            aria-label="Search a station"
            className="rounded-full border-0 h-10 px-4 bg-transparent w-full text-base text-foreground placeholder:text-foreground focus:outline-none"
          />
          {searchedValue ? (
            <CloseIcon
              className="h-10 pl-2.5 pr-4 cursor-pointer text-foreground"
              width={20}
              height={20}
              onClick={() => setSearchedValue("")}
            />
          ) : (
            <Magnify className="h-10 pl-2.5 pr-4 cursor-pointer text-foreground" width={20} />
          )}
        </div>
      </div>
      <div className="flex flex-row flex-wrap gap-5 max-w-6xl mt-8 mx-auto w-full">
        {filteredStations.length === 0 ? (
          <div className="text-foreground mx-5">
            Nu am găsit niciun rezultat cu denumirea:{" "}
            <strong className="text-foreground text-lg font-bold mb-2.5">{searchedValue}</strong>.
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
