"use client";

import Link from "next/link";

import { IStation } from "@/models/Station";
import styles from "./styles.module.scss";
import HeadphoneIcon from "@/icons/Headphone";
import Heart from "@/icons/Heart";
import useStore from "@/store/useStore";
import { useEffect, useState } from "react";

const StationItem = (data: IStation) => {
  const { addOrRemoveFavourite, isFavorite } = useStore();
  const [isStationFavourite, setIsStationFavourite] = useState(false);

  useEffect(() => {
    setIsStationFavourite(isFavorite[data.slug]);
  }, [isFavorite[data.slug]]);

  return (
    <Link className={styles.station_item} href={data.slug}>
      <div className={styles.image_container}>
        <img
          src={data.thumbnail_url}
          alt={`${data.title} | radiocrestin.ro`}
          loading={"lazy"}
          height={110}
          width={110}
        />
      </div>
      <div className={styles.station_details}>
        <p className={styles.station_name}>{data.title}</p>
        <p className={styles.song_name}>{data.now_playing.song.name}</p>
        <p className={styles.artist_name}>
          {data.now_playing.song.artist.name}
        </p>
      </div>
      <div className={styles.total_listeners}>
        {data.total_listeners} <HeadphoneIcon />
      </div>
      <div
        className={styles.favourite_heart_container}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          addOrRemoveFavourite(data.slug);
        }}
      >
        <Heart color={isStationFavourite ? "red" : "white"} />
      </div>
    </Link>
  );
};

export default StationItem;
