"use client";

import Link from "next/link";

import { IStation } from "@/models/Station";
import styles from "./styles.module.scss";
import HeadphoneIcon from "@/icons/Headphone";
import Star from "@/icons/Star";
import Heart from "@/icons/Heart";
import useFavourite from "@/store/useFavourite";
import { useContext, useEffect, useState } from "react";
import { Context } from "@/context/ContextProvider";
import { getValidImageUrl } from "@/utils";
import OfflineStatus from "@/components/OfflineStatus";
import PlayingIndicator from "@/components/PlayingIndicator";
import SparklesStar from "@/icons/SparklesStar";

type BadgeType = "station_of_day" | "most_played" | null;

interface StationItemProps extends IStation {
  badgeType?: BadgeType;
}

const BADGE_CONFIG: Record<string, { tooltip: string; styleClass?: string }> = {
  station_of_day: {
    tooltip: "Stația zilei — în fiecare zi îți recomandăm o stație nouă de descoperit.",
  },
  most_played: {
    tooltip: "Una dintre stațiile pe care le asculți cel mai des.",
    styleClass: "most_played_badge",
  },
};

const StationItem = ({ badgeType, ...data }: StationItemProps) => {
  const { ctx, setCtx } = useContext(Context);
  const { favouriteItems, toggleFavourite } = useFavourite();
  const [isStationFavourite, setIsStationFavourite] = useState(false);
  const isActive = ctx.selectedStation?.slug === data.slug;
  useEffect(() => {
    setIsStationFavourite(favouriteItems.includes(data.slug));
  }, [data.slug, favouriteItems]);

  const handleStationClick = () => {
    // Immediately set selectedStation from already-loaded stations data
    // so the audio player starts without waiting for Next.js page data fetch
    const station = ctx.stations?.find((s: IStation) => s.slug === data.slug);
    if (station) {
      setCtx({ selectedStation: station });
    }
  };

  return (
    <Link
      className={styles.station_item}
      data-station={"station-item"}
      data-active={isActive}
      href={data.slug}
      scroll={false}
      draggable={false}
      onClick={handleStationClick}
    >
      <div className={styles.image_container}>
        <img
          src={getValidImageUrl(data.now_playing?.song?.thumbnail_url || data?.thumbnail_url)}
          alt={`${data.title} | radiocrestin.ro`}
          loading={"lazy"}
          height={110}
          width={110}
          onError={(e) => {
            e.currentTarget.src = '/images/radio-white-default.jpg';
          }}
        />
      </div>
      <div className={styles.station_details}>
        <p className={styles.station_name}>
          <PlayingIndicator />
          {data.title}
          {badgeType && BADGE_CONFIG[badgeType] && (
            <span className={`${styles.promoted_badge} ${BADGE_CONFIG[badgeType].styleClass ? styles[BADGE_CONFIG[badgeType].styleClass!] : ""}`}>
              <SparklesStar width={14} height={14} />
              <span className={styles.promoted_tooltip}>
                {BADGE_CONFIG[badgeType].tooltip}
              </span>
            </span>
          )}
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
        {data.reviews_stats?.average_rating > 0 && (
          <div className={styles.average_rating}>
            <Star fillWidth={1} height={11} />
            {data.reviews_stats.average_rating.toFixed(1)}
            <span className={styles.review_count}>
              ({data.reviews_stats.number_of_reviews} {data.reviews_stats.number_of_reviews === 1 ? 'recenzie' : 'recenzii'})
            </span>
          </div>
        )}
      </div>
      {data.total_listeners > 0 && (
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
