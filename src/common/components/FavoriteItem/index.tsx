"use client";

import { IStation } from "@/models/Station";
import styles from "./styles.module.scss";
import useFavourite from "@/store/useFavourite";
import React, { useContext, useEffect, useState } from "react";
import Heart from "@/icons/Heart";
import { Context } from "@/context/ContextProvider";
import { getValidImageUrl } from "@/utils";
import OfflineStatus from "@/components/OfflineStatus";
import PlayingIndicator from "@/components/PlayingIndicator";

interface FavouriteItemProps extends IStation {
  animationDelay?: number;
}

const FavouriteItem = (data: FavouriteItemProps) => {
  const { ctx, setCtx } = useContext(Context);
  const { favouriteItems, toggleFavourite } = useFavourite();
  const [isStationFavourite, setIsStationFavourite] = useState(false);
  const isActive = ctx.selectedStation?.slug === data.slug;

  useEffect(() => {
    setIsStationFavourite(favouriteItems.includes(data.slug));
  }, [data.slug, favouriteItems]);

  const handleRemoveFavorite = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    toggleFavourite(data.slug);
  };

  const handleStationClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const station = ctx.stations?.find((s: IStation) => s.slug === data.slug);
    if (station) {
      setCtx({ selectedStation: station });
      window.history.pushState(null, "", `/${data.slug}`);
      document.title = `${station.title} | Caută şi ascultă Radiouri Creştine online`;
    }
  };

  return (
    <a
      className={styles.station_item}
      href={`/${data.slug}`}
      data-active={isActive}
      draggable={false}
      onClick={handleStationClick}
      style={{ animationDelay: `${data.animationDelay || 0}s` }}
    >
      <div className={styles.image_container}>
        <img
          src={getValidImageUrl(data.thumbnail_url)}
          alt={`${data.title} | radiocrestin.ro`}
          loading={"lazy"}
          height={100}
          width={100}
          onError={(e) => {
            e.currentTarget.src = "/images/radio-white-default.jpg";
          }}
        />
        <div className={styles.station_details}>
          <p className={styles.station_name}>
            <PlayingIndicator />
            {data.title}
          </p>
          {data.uptime?.is_up !== false ? (
            <p className={styles.song_name}>
              {data?.now_playing?.song?.name}
              {data?.now_playing?.song?.artist?.name && (
                <span className={styles.artist_name}>
                  {" · "}
                  {data?.now_playing?.song?.artist?.name}
                </span>
              )}
            </p>
          ) : (
            <OfflineStatus />
          )}
        </div>
      </div>
      <div
        className={styles.favourite_heart_container}
        onClick={handleRemoveFavorite}
      >
        <Heart color={"red"} />
      </div>
    </a>
  );
};

export default FavouriteItem;
