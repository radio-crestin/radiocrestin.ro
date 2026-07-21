"use client";

import type { IStation } from "@/models/Station";
import styles from "./styles.module.scss";
import useFavourite from "@/store/useFavourite";
import React, { useContext, useMemo, useRef } from "react";
import Heart from "@/icons/Heart";
import useSwapTransition, { songSwapEqual } from "@/hooks/useSwapTransition";
import useContentHeight from "@/hooks/useContentHeight";
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

  // Two-phase song-line swap (same motion as the header hero and player bar).
  // Initial render passes the live value straight through, so the build-time
  // prepaint markup and the first client render stay byte-identical.
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

  // Slot hugs the rendered content and glides on line-count changes; null
  // (SSR/prepaint/blank pre-live text) leaves the one-line CSS fallback.
  // See StationItem — same mechanism, kept in lockstep.
  const slotInnerRef = useRef<HTMLDivElement>(null);
  const isUp = data.uptime?.is_up !== false;
  const { height: slotHeight, settling: slotSettling } = useContentHeight(
    slotInnerRef,
    !isUp || !!(shownSong.name || shownSong.artist),
    // .song_slot's CSS fallback height: one 16px line
    16,
  );

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
          {/* Height-animated song slot: hugs the rendered text and glides on
              1↔2-line changes instead of snapping. Collapses (centering the
              lone title) only when the station has no song STRUCTURE — static
              builds blank song names but keep the object, so song-having cards
              ship with the one-line fallback and live text fills in place,
              while truly songless stations pre-collapse in the built HTML.
              The shownSong gates make height changes commit together with the
              text swap, not 170ms before it. All inputs are props- or
              effect-deterministic (prepaint constraint above: the initial
              render carries no inline style). */}
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
                  // Hold the incoming text invisible while the slot glides to
                  // a new height (see StationItem — same mechanism)
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
