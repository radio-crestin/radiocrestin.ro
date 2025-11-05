"use client";

import Link from "next/link";

import { IStation } from "@/models/Station";
import styles from "./styles.module.scss";
import useFavourite from "@/store/useFavourite";
import React, { useContext, useEffect, useState } from "react";
import Heart from "@/icons/Heart";
import { Context } from "@/context/ContextProvider";
import { getValidImageUrl } from "@/utils";

interface FavouriteItemProps extends IStation {
  animationDelay?: number;
}

const FavouriteItem = (data: FavouriteItemProps) => {
  const { ctx } = useContext(Context);
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

  return (
    <Link
      className={styles.station_item}
      href={data.slug}
      scroll={false}
      data-active={isActive}
      draggable={false}
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
        onClick={handleRemoveFavorite}
      >
        <Heart color={"red"} />
      </div>
    </Link>
  );
};

export default FavouriteItem;
