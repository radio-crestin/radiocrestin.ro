import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ClickTarget, IAnnouncement } from "@/models/Announcement";
import Slide, { type SlideHandlers } from "./Slide";
import { NextGlyph, PrevGlyph } from "./icons";
import { T } from "./strings";
import styles from "./styles";
import { useHalfVisible, useImpressionAfterDelay } from "./useImpression";
import { pageTarget } from "@/utils/announcements";

const SWIPE_MIN_PX = 40;

interface CarouselProps extends SlideHandlers {
  /** Every home item in the snapshot; only the current one is displayed. */
  items: IAnnouncement[];
  /** null before the island takes over: then the pre-paint style decides what shows. */
  visible: Set<string> | null;
  start: number;
  onImpression: (announcement: IAnnouncement) => void;
  onExpire: (announcement: IAnnouncement) => void;
}

const hidden = { display: "none" } as const;

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

export default function Carousel({ items, visible, start, onDismiss, onImpression, onExpire, onPrimary }: CarouselProps) {
  const takenOver = visible !== null;
  const [expired, setExpired] = useState<Set<string>>(() => new Set());
  const shown = visible ? items.filter((a) => visible.has(a.slug) && !expired.has(a.slug)) : items;
  const count = shown.length;
  const multi = count > 1;
  const [index, setIndex] = useState<number | null>(null);
  const [entering, setEntering] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const swipeStartRef = useRef<number | null>(null);
  // A swipe ends with a click on the slide; it must not count as a card tap.
  const swipedRef = useRef(false);

  const active = takenOver && count ? Math.min(index ?? start, count - 1) : null;
  const current = active === null ? null : shown[active];
  const prepareHeight = useHeightAnimation(viewportRef, current?.slug);

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
  // Paging stops at the ends; arrows, keys and swipes all go through here.
  const navigate = (step: number) => {
    if (active === null) return;
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
  const onDismissAnimated = useCallback(
    (a: IAnnouncement) => {
      prepareHeight();
      setEntering(null);
      onDismiss(a);
    },
    [onDismiss, prepareHeight],
  );

  // Before takeover the server's first slide shows (data-ann-a), unless the pre-paint style
  // picks another; afterwards only the current slide is displayed.
  const slideStyle = (a: IAnnouncement, i: number) => {
    if (!takenOver) return i === 0 ? undefined : hidden;
    return a === current ? undefined : hidden;
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
    >
      <div className={styles.viewport} ref={viewportRef} aria-live="polite">
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
          />
        ))}
      </div>

    </section>
  );
}
