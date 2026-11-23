import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ClickTarget, IAnnouncement } from "@/models/Announcement";
import Slide, { type SlideHandlers } from "./Slide";
import { NextGlyph, PrevGlyph } from "./icons";
import { T } from "./strings";
import styles from "./styles";
import { useAutoplay } from "./useAutoplay";
import { useHalfVisible, useImpressionAfterDelay } from "./useImpression";
import { pageTarget } from "@/utils/announcements";

const SWIPE_MIN_PX = 40;

interface CarouselProps extends SlideHandlers {
  /** Every home item in the snapshot, in the server's order; all are in the markup. */
  items: IAnnouncement[];
  /**
   * The visit's sequence (the server's order rotated to the start item, without the ones this
   * visitor must not see); null before the island takes over, when the pre-paint style decides.
   */
  sequence: IAnnouncement[] | null;
  /** autoplay_seconds (0 = off). On: every slide is laid out in one cell (styles .ann-stack). */
  autoplay: number;
  onImpression: (announcement: IAnnouncement) => void;
  onExpire: (announcement: IAnnouncement) => void;
}

const hidden = { display: "none" } as const;
/** In the autoplay stack: laid out (it counts for the card's height) but invisible. */
const stacked = { "--h": "hidden" } as React.CSSProperties;

/**
 * Animates the viewport from its current height to the new slide's height. Only user actions
 * (swipe, arrow, keyboard, dismiss) call `prepare`, so first paint and hydration never move anything.
 */
const useHeightAnimation = (viewport: React.RefObject<HTMLDivElement | null>, key: string | undefined) => {
  const from = useRef<number | null>(null);
  const prepare = useCallback(() => {
    from.current = viewport.current?.offsetHeight ?? null;
  }, [viewport]);

  useLayoutEffect(() => {
    const el = viewport.current;
    const start = from.current;
    from.current = null;
    if (!el || start === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.style.height = "";
    const end = el.offsetHeight;
    if (end === start) return;
    el.style.height = `${start}px`;
    void el.offsetHeight; // commit the start height before transitioning
    el.style.height = `${end}px`;
    const done = () => (el.style.height = "");
    el.addEventListener("transitionend", done, { once: true });
  }, [viewport, key]);

  return prepare;
};

export default function Carousel({ items, sequence, autoplay, onDismiss, onImpression, onExpire, onPrimary, onLink }: CarouselProps) {
  const takenOver = sequence !== null;
  const stack = autoplay > 0;
  const [expired, setExpired] = useState<Set<string>>(() => new Set());
  const shown = sequence ? sequence.filter((a) => !expired.has(a.slug)) : items;
  // In the stack, what was laid out at takeover stays laid out (so the height never changes by
  // itself): the sequence plus the server's first slide, which the stack style keeps in place.
  const laidOutRef = useRef<Set<string> | null>(null);
  if (stack && sequence && !laidOutRef.current) {
    laidOutRef.current = new Set([...sequence.map((a) => a.slug), items[0]?.slug]);
  }
  const count = shown.length;
  const multi = count > 1;
  const [index, setIndex] = useState<number | null>(null);
  const [entering, setEntering] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const swipeStartRef = useRef<number | null>(null);
  // A swipe ends with a click on the slide; it must not count as a card tap.
  const swipedRef = useRef(false);

  const active = takenOver && count ? Math.min(index ?? 0, count - 1) : null;
  const current = active === null ? null : shown[active];
  const animateHeight = useHeightAnimation(viewportRef, current?.slug);
  // the stack is always as tall as its tallest slide: nothing to animate
  const prepareHeight = useCallback(() => !stack && animateHeight(), [stack, animateHeight]);

  // Each slide has its own previous/next buttons, so the clicked one disappears with its slide:
  // move focus to the same button on the new slide (or to the other one at an end).
  const refocus = useRef<"prev" | "next" | null>(null);
  useLayoutEffect(() => {
    const which = refocus.current;
    refocus.current = null;
    if (!which || !current) return;
    const slide = rootRef.current?.querySelector(`section[data-ann="${current.slug}"]`);
    const wanted = slide?.querySelector<HTMLButtonElement>(`.${which === "prev" ? styles.navPrev : styles.navNext}`);
    const other = slide?.querySelector<HTMLButtonElement>(`.${which === "prev" ? styles.navNext : styles.navPrev}`);
    (wanted && !wanted.disabled ? wanted : other)?.focus();
  }, [current]);
  const onScreen = useHalfVisible(rootRef);

  const goTo = useCallback(
    (target: number) => {
      prepareHeight();
      setIndex(target);
      setEntering(shown[target]?.slug ?? null);
    },
    [shown, prepareHeight],
  );

  // Not a user page: no swipe, no stop, and the impression still waits for 50% / 1 s.
  const autoplayNext = () => active !== null && active < count - 1 && goTo(active + 1);
  const autoplayState = useAutoplay({ seconds: autoplay, count, active, onScreen }, autoplayNext);

  useImpressionAfterDelay(onScreen, current?.slug ?? null, () => current && onImpression(current));

  // hide_after_seconds counts only the time this announcement is on screen. Taking it away
  // would move the page without user input, so it leaves at the next navigation instead;
  // when it is the only one, the parent hides it while keeping its space.
  const shownMsRef = useRef<Record<string, number>>({});
  useEffect(() => {
    const seconds = current?.hide_after_seconds;
    if (!onScreen || !current || !seconds) return;
    const startedAt = Date.now();
    const shownMs = shownMsRef.current;
    const remaining = Math.max(0, seconds * 1000 - (shownMs[current.slug] || 0));
    const timer = window.setTimeout(() => (multi ? markExpired(current) : onExpire(current)), remaining);
    return () => {
      window.clearTimeout(timer);
      shownMs[current.slug] = (shownMs[current.slug] || 0) + Date.now() - startedAt;
    };
    // markExpired is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onScreen, current, multi, onExpire]);

  const pendingExpiry = useRef<Set<string>>(new Set());
  const markExpired = (a: IAnnouncement) => pendingExpiry.current.add(a.slug);
  // Paging stops at the ends; arrows, keys and swipes all go through here (and stop autoplay).
  const navigate = (step: number) => {
    if (active === null) return;
    autoplayState.stop();
    const target = pageTarget(active, count, step);
    if (target === null) return;
    const leaving = shown[active];
    if (pendingExpiry.current.has(leaving.slug)) {
      // the expired one leaves now: the target shifts down by one when it was after it
      pendingExpiry.current.delete(leaving.slug);
      prepareHeight();
      setExpired((e) => new Set(e).add(leaving.slug));
      const next = step > 0 ? active : target;
      setIndex(next);
      setEntering(shown.filter((a) => a !== leaving)[next]?.slug ?? null);
      return;
    }
    goTo(target);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    swipedRef.current = false;
    if (!(e.target as HTMLElement).closest("a,button")) swipeStartRef.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const startX = swipeStartRef.current;
    swipeStartRef.current = null;
    if (startX === null || !multi) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) <= SWIPE_MIN_PX) return;
    swipedRef.current = true;
    navigate(dx < 0 ? 1 : -1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!multi) return;
    if (e.key === "ArrowLeft") navigate(-1);
    if (e.key === "ArrowRight") navigate(1);
  };

  const onPrimaryUnlessSwiped = useCallback(
    (a: IAnnouncement, target: ClickTarget) => {
      if (target === "card" && swipedRef.current) return;
      onPrimary(a, target);
    },
    [onPrimary],
  );

  // Dismissing changes the height too: animate it like a navigation.
  const stopAutoplay = autoplayState.stop;
  const onDismissAnimated = useCallback(
    (a: IAnnouncement) => {
      stopAutoplay();
      prepareHeight();
      setEntering(null);
      onDismiss(a);
    },
    [onDismiss, prepareHeight, stopAutoplay],
  );

  // Before takeover the server's first slide shows (data-ann-a), unless the pre-paint style
  // picks another; afterwards only the current slide is displayed.
  // In the autoplay stack the others stay laid out but invisible instead.
  const slideStyle = (a: IAnnouncement, i: number) => {
    if (!takenOver) return i === 0 ? undefined : stack ? stacked : hidden;
    if (a === current) return undefined;
    return stack && laidOutRef.current?.has(a.slug) ? stacked : hidden;
  };

  // Previous, "i din N", next: one cluster inside each slide, beside its buttons (wide) or on
  // its tag row (phones). Before takeover the count is drawn by the pre-paint style.
  // At the ends the button fades and is disabled. Before takeover nothing is disabled: the
  // pre-paint style fades the start slide's buttons with --pf / --nf instead.
  const nav = (a: IAnnouncement) => {
    if (!multi) return undefined;
    const position = active === null ? null : shown.indexOf(a);
    const atStart = position === 0;
    const atEnd = position === count - 1;
    return (
      <div className={styles.nav} data-ann-m="">
        <button
          type="button"
          className={`${styles.navBtn} ${styles.navPrev}`}
          aria-label={T.previous}
          disabled={atStart}
          onClick={() => {
            refocus.current = "prev";
            navigate(-1);
          }}
        >
          <PrevGlyph />
        </button>
        <span className={styles.count} data-ann-c="" aria-hidden="true">
          {active === null ? "" : T.count(shown.indexOf(a) + 1, count)}
        </span>
        <button
          type="button"
          className={`${styles.navBtn} ${styles.navNext}`}
          aria-label={T.next}
          disabled={atEnd}
          onClick={() => {
            refocus.current = "next";
            navigate(1);
          }}
        >
          <NextGlyph />
        </button>
      </div>
    );
  };

  return (
    <section
      ref={rootRef}
      className={`${styles.ann} ${styles.carousel}`}
      aria-roledescription="carousel"
      aria-label={T.carousel}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      {...(stack && autoplayState.handlers)}
    >
      {/* Autoplay moves on by itself: announce only what the user brings up. */}
      <div
        className={`${styles.viewport} ${stack ? styles.stack : ""}`}
        ref={viewportRef}
        aria-live={autoplayState.running ? "off" : "polite"}
      >
        {items.map((a, i) => (
          <Slide
            key={a.slug}
            announcement={a}
            label={active === null ? a.title : T.count(shown.indexOf(a) + 1, count)}
            nav={nav(a)}
            serverFirst={!takenOver && i === 0}
            entering={entering === a.slug}
            active={active === null ? i === 0 : a === current}
            style={slideStyle(a, i)}
            onPrimary={onPrimaryUnlessSwiped}
            onDismiss={onDismissAnimated}
            onLink={onLink}
          />
        ))}
      </div>

    </section>
  );
}
