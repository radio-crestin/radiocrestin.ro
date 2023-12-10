"use client";

import Link from "next/link";

import { IStation } from "@/models/Station";
import styles from "./styles.module.scss";
import useFavourite from "@/store/useFavourite";
import React, { useEffect, useState } from "react";
import CloseIcon from "@/icons/CloseIcon";

const FavouriteItem = (data: IStation) => {
  const { favouriteItems, toggleFavourite } = useFavourite();
  const [isStationFavourite, setIsStationFavourite] = useState(false);

  useEffect(() => {
    setIsStationFavourite(favouriteItems.includes(data.slug));
  }, [data.slug, favouriteItems]);

  return (
    <Link className={styles.station_item} href={data.slug} scroll={false}>
      <div className={styles.image_container}>
        <img
          src={data.thumbnail_url}
          alt={`${data.title} | radiocrestin.ro`}
          loading={"lazy"}
          height={100}
          width={100}
        />
        <div className={styles.station_details}>
          <p className={styles.station_name}>{data.title}</p>
          <p className={styles.song_name}>
            {data?.now_playing?.song.name}
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
        <CloseIcon width={16} height={16} scale={1} />
      </div>
    </Link>
  );
};

export default FavouriteItem;
