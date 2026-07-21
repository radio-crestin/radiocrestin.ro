"use client";

import type { IStation } from "@/models/Station";
import styles from "./styles.module.scss";
import HeadphoneIcon from "@/icons/Headphone";
import Star from "@/icons/Star";
import Heart from "@/icons/Heart";
import useFavourite from "@/store/useFavourite";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Context } from "@/context/ContextProvider";
import useSwapTransition, { songSwapEqual } from "@/hooks/useSwapTransition";
import useContentHeight from "@/hooks/useContentHeight";
import { getValidImageUrl, stepImageFallback } from "@/utils";
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

  // Two-phase song-line swap (same motion as the header hero and player bar):
  // the rendered text trails the live poll by a 170ms fade-out, then the new
  // song rises into place instead of snapping.
  const liveSong = useMemo(
    () => ({
      name: data.now_playing?.song?.name || "",
      artist: data.now_playing?.song?.artist?.name || "",
    }),
    [data.now_playing?.song?.name, data.now_playing?.song?.artist?.name],
  );
  const { shown: shownSong, anim: songAnim } = useSwapTransition(
    liveSong,
    songSwapEqual,
  );

  // The song slot hugs its rendered content (no reserved second line pushing
  // the rating away): once real text (or the offline badge) is on screen, its
  // measured height is set inline on the slot and the CSS height transition
  // turns 1↔2-line changes into a glide. While null (SSR, prepaint, blank
  // pre-live text) the slot's one-line CSS fallback height applies.
  const slotInnerRef = useRef<HTMLDivElement>(null);
  const isUp = data.uptime?.is_up !== false;
  const { height: slotHeight, settling: slotSettling } = useContentHeight(
    slotInnerRef,
    !isUp || !!(shownSong.name || shownSong.artist),
    // .song_slot's CSS fallback height: 1.12rem at the 16px root
    17.92,
  );

  const handleStationClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const station = ctx.stations?.find((s: IStation) => s.slug === data.slug);
    if (station) {
      setCtx({ selectedStation: station });
      if (!ctx.inPagePlayback) {
        window.history.pushState(null, "", `/${data.slug}/`);
      }
    }
  };

  return (
    <a
      className={styles.station_item}
      data-station={"station-item"}
      data-active={isActive}
      href={`/${data.slug}/`}
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
          onError={(e) => stepImageFallback(e.currentTarget, data?.thumbnail_url)}
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
        {/* Height-animated song slot: hugs the rendered text (rating sits
            right under the song, no reserved dead line) and glides on 1↔2-line
            changes instead of snapping. Collapses (centering the lone title)
            only when the station has no song STRUCTURE — static builds blank
            song names but keep the object, so song-having cards ship with the
            one-line fallback and live text fills in place, while truly
            songless stations pre-collapse in the built HTML. The shownSong
            gates make height changes commit together with the text swap
            (mid-invisibility), not 170ms before it. */}
        <div
          className={`${styles.song_slot}${
            isUp &&
            data.now_playing?.song == null &&
            !shownSong.name &&
            !shownSong.artist
              ? ` ${styles.song_slot_empty}`
              : ""
          }`}
          style={slotHeight != null ? { height: slotHeight } : undefined}
        >
          <div ref={slotInnerRef}>
            {isUp ? (
              <p
                className={`${styles.song_name}${
                  songAnim === "leave"
                    ? ` ${styles.song_leave}`
                    : songAnim === "enter"
                      ? ` ${styles.song_enter}`
                      : ""
                }`}
                // While the slot is still gliding to a new height, hold the
                // incoming text invisible — fading it in mid-glide shows it
                // sliced by the clip edge. Same-height swaps keep the
                // immediate fade. Delay changes retime, never restart, so a
                // finished fade can't blink when settling flips back.
                style={
                  songAnim === "enter" && slotSettling
                    ? ({ "--song-enter-delay": "0.2s" } as React.CSSProperties)
                    : undefined
                }
              >
                {shownSong.name}
                {shownSong.artist && (
                  <span className={styles.artist_name}>
                    {" · "}
                    {shownSong.artist}
                  </span>
                )}
              </p>
            ) : (
              <OfflineStatus />
            )}
          </div>
        </div>
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
    </a>
  );
};

export default StationItem;
