"use client";

import Link from "next/link";

import { IStation, IStationExtended } from "@/common/models/Station";
import styles from "./styles.module.scss";
import useFavourite from "@/common/store/useFavourite";
import React, { useEffect, useState } from "react";
import Heart from "@/icons/Heart";
import { useSelectedStation } from "@/common/providers/SelectedStationProvider";

const FavouriteItem = (data: IStation) => {
  const { favouriteItems, toggleFavourite } = useFavourite();
  
  // Try to use context, but handle the case where we're outside the provider
  let setSelectedStation: ((station: IStationExtended) => void) | null = null;
  let stations: IStationExtended[] = [];
  try {
    const context = useSelectedStation();
    setSelectedStation = context.setSelectedStation;
    stations = context.stations;
  } catch (error) {
    // We're outside the provider, which is fine for the home page
  }
  
  const [isStationFavourite, setIsStationFavourite] = useState(false);
  const isActive = false; // Removed store dependency for URL-based navigation

  useEffect(() => {
    setIsStationFavourite(favouriteItems.includes(data.slug));
  }, [data.slug, favouriteItems]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // If we're in a provider context (station page), prevent navigation and update context
    if (setSelectedStation) {
      e.preventDefault(); // Prevent Next.js navigation
      
      const fullStation = stations.find(s => s.slug === data.slug);
      if (fullStation) {
        // Update the context immediately
        setSelectedStation(fullStation);
        
        // Update URL without triggering navigation
        window.history.pushState({}, '', `/${data.slug}`);
      }
    }
    // Otherwise (home page), let Next.js handle the navigation normally
  };

  return (
    <Link
      className={styles.station_item}
      href={`/${data.slug}`}
      scroll={false}
      data-active={isActive}
      draggable={false}
      onClick={handleClick}
    >
      <div className={styles.image_container}>
        <img
          src={data.thumbnail_url || ""}
          alt={`${data.title} | radiocrestin.ro`}
          loading={"lazy"}
          height={100}
          width={100}
        />
        <div className={styles.station_details}>
          <p className={styles.station_name}>{data.title}</p>
          <p className={styles.song_name}>
            {data?.now_playing?.song?.name}
            {data?.now_playing?.song?.artist?.name && (
              <span className={styles.artist_name}>
                {" · "}
                {data?.now_playing?.song?.artist?.name}
              </span>
            )}
          </p>
        </div>
      </div>
      <div
        className={styles.favourite_heart_container}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleFavourite(data.slug);
        }}
      >
        <Heart color={"red"} />
      </div>
    </Link>
  );
};

export default FavouriteItem;
