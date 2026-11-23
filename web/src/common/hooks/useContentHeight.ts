import { useEffect, useRef, useState } from "react";

/**
 * Measured pixel height of an element's content, for animating a clipping
 * wrapper (the station cards' song slot) to hug whatever is rendered inside:
 * the wrapper gets `height: <n>px` + a CSS height transition, so 1↔2-line
 * song changes glide instead of snapping or reserving dead space.
 *
 * `height` is null until measured on the client — and always when `enabled`
 * is false — so SSR/prepaint markup ships no inline style (hydration
 * adoption byte-identity) and the wrapper's CSS fallback height applies.
 * Re-measures via ResizeObserver, which also catches web-font swaps and
 * viewport resizes that rewrap the text.
 *
 * `settling` is true for 500ms after a measurement actually changes the
 * wrapper's rendered height (vs `fallbackHeight` while unmeasured). The
 * cards use it to hold the incoming text invisible until the slot has
 * finished making room — fading text in mid-glide shows it sliced by the
 * clip edge. The window outlives the enter animation's delay+duration
 * (0.2s + 0.24s) so flipping back never retimes a still-running fade.
 */
const useContentHeight = (
  ref: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  fallbackHeight: number,
) => {
  const [height, setHeight] = useState<number | null>(null);
  const [settling, setSettling] = useState(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const renderedRef = useRef<number | null>(null);
  const settleTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!enabled) {
      renderedRef.current = null;
      setHeight(null);
      return;
    }
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      if (!enabledRef.current) return;
      const h = el.getBoundingClientRect().height;
      const prev = renderedRef.current ?? fallbackHeight;
      if (Math.abs(h - prev) > 1) {
        setSettling(true);
        window.clearTimeout(settleTimer.current);
        settleTimer.current = window.setTimeout(() => setSettling(false), 500);
      }
      renderedRef.current = h;
      setHeight(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, enabled, fallbackHeight]);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  return { height, settling };
};

export default useContentHeight;
