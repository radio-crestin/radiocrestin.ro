"use client";

import styles from "./styles.module.scss";

const PlayingIndicator = () => {
  return (
    <span className={styles.playing_indicator}>
      <span></span>
      <span></span>
      <span></span>
      <span></span>
    </span>
  );
};

export default PlayingIndicator;
