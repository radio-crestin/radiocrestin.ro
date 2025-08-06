"use client";

import Link from "next/link";

import { IStation, IStationExtended } from "@/common/models/Station";
import styles from "./styles.module.scss";
import HeadphoneIcon from "@/icons/Headphone";
import Heart from "@/icons/Heart";
import useFavourite from "@/common/store/useFavourite";
import { useEffect, useState } from "react";
import { useSelectedStation } from "@/common/providers/SelectedStationProvider";

const StationItem = (data: IStation) => {
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
      data-station={"station-item"}
      data-active={isActive}
      href={`/${data.slug}`}
      scroll={false}
      draggable={false}
      onClick={handleClick}
    >
      <div className={styles.image_container}>
        {(data.now_playing?.song?.thumbnail_url || data?.thumbnail_url) ? (
          <img
            src={data.now_playing?.song?.thumbnail_url || data?.thumbnail_url || ""}
            alt={`${data.title} | radiocrestin.ro`}
            loading={"lazy"}
            height={110}
            width={110}
          />
        ) : (
          <div
            className={styles.image_skeleton}
            style={{
              width: 110,
              height: 110,
            }}
          />
        )}
      </div>
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
      {(data.total_listeners || 0) > 0 && (
        <div className={styles.total_listeners}>
          {data?.total_listeners} <HeadphoneIcon />
        </div>
      )}
      <div
        className={styles.favourite_heart_container}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleFavourite(data.slug);
        }}
      >
        <Heart color={isStationFavourite ? "red" : "white"} />
      </div>
    </Link>
  );
};

export default StationItem;
