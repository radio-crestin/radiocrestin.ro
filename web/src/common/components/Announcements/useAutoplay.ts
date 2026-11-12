// Optional auto-advance (SPEC "Order and rotation"): with settings.autoplay_seconds > 0 the card
// moves to the next announcement every N seconds. It waits while someone is looking at or using
// the card, and stops for good once they page or dismiss, or when it reaches the last one.
import { useCallback, useEffect, useRef, useState } from "react";

export interface AutoplayState {
  /** autoplay_seconds, already limited to 0 or 3–60 */
  seconds: number;
  /** items in the visit's sequence */
  count: number;
  /** the current item's place in it */
  active: number | null;
  reducedMotion: boolean;
  /** the user paged or dismissed: autoplay is over for this page view */
  stopped: boolean;
  /** hovered, touched or focused */
  engaged: boolean;
  tabHidden: boolean;
  /** at least half of the card on screen */
  onScreen: boolean;
}

/** Whether the next automatic move may be scheduled now. */
export const autoplayCanRun = (s: AutoplayState): boolean =>
  s.seconds > 0 &&
  s.count > 1 &&
  s.active !== null &&
  s.active < s.count - 1 &&
  !s.reducedMotion &&
  !s.stopped &&
  !s.engaged &&
  !s.tabHidden &&
  s.onScreen;

const reducedMotionQuery = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

const useMediaMatch = (query: () => MediaQueryList | null) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const list = query();
    if (!list) return;
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return matches;
};

const useTabHidden = () => {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.visibilityState === "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return hidden;
};

/**
 * Schedules `advance` while autoplay may run; any pause restarts the full interval. Returns
 * `stop` (call it on a user page or dismiss) and the handlers that mark the card as engaged.
 */
export const useAutoplay = (
  { seconds, count, active, onScreen }: Pick<AutoplayState, "seconds" | "count" | "active" | "onScreen">,
  advance: () => void,
) => {
  const reducedMotion = useMediaMatch(reducedMotionQuery);
  const tabHidden = useTabHidden();
  const [stopped, setStopped] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  const running = autoplayCanRun({
    seconds,
    count,
    active,
    reducedMotion,
    stopped,
    engaged: hovered || touched || focused,
    tabHidden,
    onScreen,
  });

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => advanceRef.current(), seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [running, seconds, active]);

  const stop = useCallback(() => setStopped(true), []);

  const handlers = {
    onPointerEnter: (e: React.PointerEvent) => e.pointerType === "mouse" && setHovered(true),
    onPointerLeave: () => {
      setHovered(false);
      setTouched(false);
    },
    onTouchStart: () => setTouched(true),
    onTouchEnd: () => setTouched(false),
    onTouchCancel: () => setTouched(false),
    onFocus: () => setFocused(true),
    onBlur: (e: React.FocusEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
    },
  };

  return { stop, handlers, running };
};
