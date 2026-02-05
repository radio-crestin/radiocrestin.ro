"use client";

import { useEffect, useRef, useState } from "react";
import { PLAYBACK_STATE } from "@/models/enum";
import usePlaybackState from "@/store/usePlaybackState";
import usePlayer from "@/store/usePlayer";
import styles from "./styles.module.scss";

const MIN_HEIGHT = 4;
const MAX_HEIGHT = 14;

const PlayingIndicator = () => {
  const { playbackState, hasError } = usePlaybackState();
  const { playerVolume } = usePlayer();
  const [heights, setHeights] = useState([MIN_HEIGHT, MIN_HEIGHT, MIN_HEIGHT, MIN_HEIGHT]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isPlaying =
    playbackState === PLAYBACK_STATE.PLAYING && playerVolume > 0 && !hasError;

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setHeights([
          MIN_HEIGHT + Math.random() * (MAX_HEIGHT - MIN_HEIGHT),
          MIN_HEIGHT + Math.random() * (MAX_HEIGHT - MIN_HEIGHT),
          MIN_HEIGHT + Math.random() * (MAX_HEIGHT - MIN_HEIGHT),
          MIN_HEIGHT + Math.random() * (MAX_HEIGHT - MIN_HEIGHT),
        ]);
      }, 150);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setHeights([MIN_HEIGHT, MIN_HEIGHT, MIN_HEIGHT, MIN_HEIGHT]);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying]);

  return (
    <span className={styles.playing_indicator}>
      {heights.map((height, i) => (
        <span key={i} style={{ height: `${height}px` }} />
      ))}
    </span>
  );
};

export default PlayingIndicator;
