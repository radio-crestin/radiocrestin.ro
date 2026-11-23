import { useEffect, useState } from "react";

const VISIBLE_RATIO = 0.5;
const IMPRESSION_DELAY_MS = 1000;

/** True while at least half of the element is on screen. */
export const useHalfVisible = (ref: React.RefObject<HTMLElement | null>) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.intersectionRatio >= VISIBLE_RATIO),
      { threshold: [0, VISIBLE_RATIO, 1] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return visible;
};

/** Calls `onImpression` once the element has been at least half visible for one second. */
export const useImpressionAfterDelay = (visible: boolean, key: string | null, onImpression: () => void) => {
  useEffect(() => {
    if (!visible || !key) return;
    const timer = window.setTimeout(onImpression, IMPRESSION_DELAY_MS);
    return () => window.clearTimeout(timer);
    // `key` identifies what is on screen; re-arm only when it or visibility changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, key]);
};
