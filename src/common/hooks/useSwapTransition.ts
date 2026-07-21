import { useEffect, useRef, useState } from "react";

export type SwapAnim = "" | "leave" | "enter";

/** Now-playing line shape shared by the station cards' swap transition. */
export interface ISongSwapInfo {
  name: string;
  artist: string;
}

export const songSwapEqual = (a: ISongSwapInfo, b: ISongSwapInfo): boolean =>
  a.name === b.name && a.artist === b.artist;

const strictEqual = <T>(a: T, b: T): boolean => a === b;

/**
 * Two-phase swap shared by the header hero, player bar and station cards:
 * the rendered value trails the live one by a 170ms fade-out ("leave"),
 * then the new value rises into place ("enter"). Reduced-motion users get
 * an instant swap. Pair the returned anim phase with classes running the
 * 0.17s swap-out / 0.24s swap-in keyframes.
 *
 * The initial render returns the live value with no phase class, so SSR'd
 * / pre-painted markup stays byte-identical to the first client render
 * (the FavouriteItem hydration-adoption constraint).
 */
const useSwapTransition = <T>(
  live: T,
  isEqual: (a: T, b: T) => boolean = strictEqual,
) => {
  const [shown, setShown] = useState(live);
  const [anim, setAnim] = useState<SwapAnim>("");
  const liveRef = useRef(live);
  liveRef.current = live;
  const isEqualRef = useRef(isEqual);
  isEqualRef.current = isEqual;

  useEffect(() => {
    if (isEqualRef.current(live, shown)) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(live);
      setAnim("");
      return;
    }
    setAnim("leave");
    const t = window.setTimeout(() => {
      setShown(liveRef.current);
      setAnim("enter");
    }, 170);
    return () => window.clearTimeout(t);
  }, [live, shown]);

  return { shown, anim };
};

export default useSwapTransition;
