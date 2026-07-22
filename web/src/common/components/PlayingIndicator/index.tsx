"use client";

import { PLAYBACK_STATE } from "@/models/enum";
import usePlaybackState from "@/store/usePlaybackState";
import usePlayer from "@/store/usePlayer";
import styles from "./styles.module.scss";

interface PlayingIndicatorProps {
  /** One indicator lives in every grid/favourite card — only the active
   * station's may animate, the rest must stay completely inert. */
  isActive: boolean;
}

// The bars are a pure CSS keyframe animation (compositor-only scaleY), so an
// animating indicator produces zero React updates and zero DOM mutations.
// The previous version ran a 150ms setInterval writing random inline heights
// in EVERY mounted card whenever anything played (~65 hidden instances,
// ~1,700 style writes/s) — burning CPU for hours and flooding the PostHog
// session-replay recorder, which serializes every mutation.
const PlayingIndicator = ({ isActive }: PlayingIndicatorProps) => {
  // Boolean selectors gated on isActive: inactive instances never re-render
  // on store writes, and nobody re-renders on unrelated high-frequency
  // fields (hlsPlaybackTimestamp ticks every ~6s during HLS playback).
  const isPlaying = usePlaybackState(
    (s) =>
      isActive && s.playbackState === PLAYBACK_STATE.PLAYING && !s.hasError,
  );
  const isAudible = usePlayer((s) => isActive && s.playerVolume > 0);

  return (
    <span
      className={
        isPlaying && isAudible
          ? `${styles.playing_indicator} ${styles.animating}`
          : styles.playing_indicator
      }
    >
      <span />
      <span />
      <span />
      <span />
    </span>
  );
};

export default PlayingIndicator;
