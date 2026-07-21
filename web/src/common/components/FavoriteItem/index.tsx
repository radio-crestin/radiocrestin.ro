"use client";

import type { IStation } from "@/models/Station";
import styles from "./styles.module.scss";
import useFavourite from "@/store/useFavourite";
import React, { useContext } from "react";
import Heart from "@/icons/Heart";
import { Context } from "@/context/ContextProvider";
import { getValidImageUrl, stepImageFallback } from "@/utils";
import OfflineStatus from "@/components/OfflineStatus";
import PlayingIndicator from "@/components/PlayingIndicator";

/**
 * Also rendered at build time into the FavoritesPrepaint template (via
 * FavouriteStationsSection). Keep the output deterministic — no useId,
 * Date/random/window-dependent values, no conditional adjacent text — so the
 * pre-painted DOM stays byte-identical to the first client render and React
 * 19 hydration can adopt it instead of re-rendering.
 */
const FavouriteItem = (data: IStation) => {
  const { ctx, setCtx } = useContext(Context);
  const { toggleFavourite } = useFavourite();
  const isActive = ctx.selectedStation?.slug === data.slug;

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
      window.history.pushState(null, "", `/${data.slug}/`);
    }
  };

  return (
    <a
      className={styles.station_item}
      href={`/${data.slug}/`}
      data-active={isActive}
      draggable={false}
      onClick={handleStationClick}
    >
      <div className={styles.image_container}>
        <img
          src={getValidImageUrl(data.thumbnail_url)}
          alt={`${data.title} | radiocrestin.ro`}
          loading={"lazy"}
          height={100}
          width={100}
          onError={(e) => stepImageFallback(e.currentTarget)}
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
