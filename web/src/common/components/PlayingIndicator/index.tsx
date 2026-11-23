"use client";

import { useLayoutEffect, useRef, useState } from "react";
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
  const animating = isPlaying && isAudible;

  const wrapRef = useRef<HTMLSpanElement>(null);
  // The rendered class lags `animating` on the way DOWN: Blink does not
  // start transitions from a removed animation's value (verified — bars
  // snapped), so on pause we first freeze each bar's current animated
  // height as an inline transform WHILE the animation still runs, then drop
  // the class, then release the inline value a frame later — that plain
  // style change does transition, and the bars settle softly to rest.
  const [showAnim, setShowAnim] = useState(false);
  const wasAnimatingRef = useRef(false);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const bars = wrap ? (Array.from(wrap.children) as HTMLElement[]) : [];
    const wasAnimating = wasAnimatingRef.current;
    wasAnimatingRef.current = animating;

    if (animating) {
      // (Re)starting: clear any leftover frozen transforms — the animation
      // overrides inline styles anyway, this just keeps the DOM tidy.
      bars.forEach((bar) => (bar.style.transform = ""));
      setShowAnim(true);
      return;
    }

    // Only an animating→stopped flip needs the handoff. On mount (all ~65
    // instances) and on unrelated re-renders this effect does nothing.
    if (!wasAnimating || !bars.length) return;

    // Stopping: freeze at the current animated frame…
    bars.forEach(
      (bar) => (bar.style.transform = getComputedStyle(bar).transform),
    );
    setShowAnim(false);
    // …and release on the next frame so the transform transition (with its
    // staggered per-bar delays) carries every bar down to the resting scale.
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bars.forEach((bar) => (bar.style.transform = ""));
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [animating]);

  return (
    <span
      ref={wrapRef}
      className={
        showAnim
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
