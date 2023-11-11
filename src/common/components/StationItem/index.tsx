"use client"; // TODO: TEMP - rm it later

import { IStation } from "@/models/Station";
import { useEffect } from "react";
import styles from "./styles.module.scss";
import HeadphoneIcon from "@/icons/Headphone";
import Heart from "@/icons/Heart";
import useStore from "@/store/useStore";

const StationItem = (data: IStation) => {
  const { addOrRemoveFavourite } = useStore();

  useEffect(() => {
    console.log("data", data);
  }, [data]);

  return (
    <div className={styles.station_item}>
      <div className={styles.image_container}>
        <img src={data.thumbnail_url} alt={"test"} loading={"lazy"} />
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
        onClick={() => addOrRemoveFavourite(data.slug)}
      >
        <Heart color={"red"} />
      </div>
    </div>
  );
};

export default StationItem;
