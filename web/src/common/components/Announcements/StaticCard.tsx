import React, { useRef } from "react";
import type { IAnnouncement } from "@/models/Announcement";
import Slide, { type SlideHandlers } from "./Slide";
import styles from "./styles";
import { useHalfVisible, useImpressionAfterDelay } from "./useImpression";

interface StaticCardProps extends SlideHandlers {
  announcement: IAnnouncement;
  onImpression: (announcement: IAnnouncement) => void;
}

/** One announcement on its own (no carousel), as listed in a station's sheet. */
export default function StaticCard({ announcement, onImpression, ...handlers }: StaticCardProps) {
  const ref = useRef<HTMLElement>(null);
  const visible = useHalfVisible(ref);
  useImpressionAfterDelay(visible, announcement.slug, () => onImpression(announcement));

  return (
    <article ref={ref} className={`${styles.ann} ${styles.compact}`}>
      <Slide announcement={announcement} {...handlers} />
    </article>
  );
}
