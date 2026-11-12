import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { IAnnouncement } from "@/models/Announcement";
import useAnnouncementsStore from "@/store/useAnnouncementsStore";
import useAnnouncementsUi, { closeStationSheet, openStationSheet } from "@/store/useAnnouncementsUi";
import { isForStation } from "@/utils/announcements";
import { markLive, takePendingTaps } from "./gate";
import { useAnnouncements } from "./view";
import StaticCard from "./StaticCard";
import { BellGlyph, CloseGlyph } from "./icons";
import { T } from "./strings";
import styles from "./styles";
import useAnnouncementActions from "./useAnnouncementActions";

const POPOVER_GAP_PX = 12;
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex="0"]';

/** The station's announcements in the snapshot, and which of them may show (null before takeover). */
const useStationAnnouncements = (stationSlug: string) => {
  const { snapshot, visible } = useAnnouncements();
  const all = useMemo(
    () => snapshot.announcements.filter((a) => isForStation(a, stationSlug)),
    [snapshot, stationSlug],
  );
  const shown = visible ? all.filter((a) => visible.has(a.slug)) : all;
  return { all, shown, takenOver: visible !== null };
};

export interface BellProps {
  stationSlug: string;
  stationTitle: string;
  /** `header` on the station page, `player` in the player bar. */
  variant: "header" | "player";
}

/**
 * A bell with the number of the station's announcements; opens their sheet. Rendered into the
 * HTML from the snapshot: the count comes from CSS counters over one marker per announcement,
 * so the pre-paint style can hide markers (and the whole bell) before first paint.
 */
export function StationAnnouncementsBell({ stationSlug, stationTitle, variant }: BellProps) {
  const { all, shown, takenOver } = useStationAnnouncements(stationSlug);
  const seen = useAnnouncementsStore((s) => s.seen);
  const open = useAnnouncementsUi((s) => s.stationSheet?.stationSlug === stationSlug);
  const toggle = () =>
    open ? closeStationSheet() : openStationSheet({ stationSlug, stationTitle, slugs: shown.map((a) => a.slug) });

  // Taken over: a tap made while the code was loading opens the sheet now.
  useLayoutEffect(() => {
    if (!takenOver) return;
    markLive();
    if (takePendingTaps(["bell"]).some((t) => t.slug === stationSlug) && shown.length) toggle();
    // once, at takeover
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takenOver]);

  if (!shown.length) return null;

  const allSeen = takenOver && shown.every((a) => seen[a.slug]);
  const isShown = (a: IAnnouncement) => shown.includes(a);
  return (
    <button
      type="button"
      data-ann-b={stationSlug}
      className={`${styles.bell} ${variant === "header" ? styles.bellHeader : styles.bellPlayer}`}
      aria-label={T.bellLabel}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={toggle}
    >
      <BellGlyph />
      <span className={`${styles.badge} ${allSeen ? styles.badgeSeen : ""}`}>
        {all.map((a) => (
          <span key={a.slug} data-ann={a.slug} style={isShown(a) ? undefined : { display: "none" }} />
        ))}
      </span>
    </button>
  );
}

/** Above the player bar, right-aligned with it; bottom-right of the window when there is none. */
const popoverPosition = (): React.CSSProperties => {
  const player = document.querySelector("[data-radio-player]")?.getBoundingClientRect();
  if (!player) return { right: 24, bottom: 24 };
  return {
    right: Math.max(16, window.innerWidth - player.right),
    bottom: window.innerHeight - player.top + POPOVER_GAP_PX,
  };
};

interface SheetProps {
  stationSlug: string;
  stationTitle: string;
}

const StationSheet = ({ stationSlug, stationTitle }: SheetProps) => {
  const { remove } = useAnnouncements();
  const { shown: items } = useStationAnnouncements(stationSlug);
  const [position, setPosition] = useState<React.CSSProperties>({});
  const popRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useLayoutEffect(() => {
    const place = () => setPosition(popoverPosition());
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, []);

  // Focus moves in on open and back on close; Escape closes.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    popRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeStationSheet();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, []);

  // Dismissing the last card closes the sheet.
  useEffect(() => {
    if (!items.length) closeStationSheet();
  }, [items.length]);

  const positionOf = useCallback(
    (a: IAnnouncement) => Math.max(0, itemsRef.current.findIndex((x) => x.slug === a.slug)),
    [],
  );
  const actions = useAnnouncementActions({ stationSlug, positionOf, remove });

  return createPortal(
    <div className={styles.popScrim} onMouseDown={(e) => e.target === e.currentTarget && closeStationSheet()}>
      <div ref={popRef} className={styles.pop} style={position} role="dialog" aria-label={T.stationSheetTitle}>
        <div className={styles.popHandle} aria-hidden="true" />
        <div className={styles.popHead}>
          <div>
            <b>{T.stationSheetTitle}</b>
            <small>{T.stationSheetSub(stationTitle)}</small>
          </div>
          <button
            type="button"
            className={`${styles.btn} ${styles.close}`}
            aria-label={T.close}
            onClick={closeStationSheet}
          >
            <CloseGlyph />
          </button>
        </div>
        <div className={styles.popList}>
          {items.map((a) => (
            <StaticCard key={a.slug} announcement={a} {...actions} />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
};

/** Renders the open station sheet, if any. Mounted once per page, by Announcements. */
export function StationAnnouncementsSheet() {
  const sheet = useAnnouncementsUi((s) => s.stationSheet);
  return sheet ? <StationSheet stationSlug={sheet.stationSlug} stationTitle={sheet.stationTitle} /> : null;
}
