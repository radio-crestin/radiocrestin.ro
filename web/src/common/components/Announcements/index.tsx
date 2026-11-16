// The announcements entry the pages and apps import. It stays tiny: the card, the bells, the
// dialogs and the event code are a separate chunk (lazy.tsx) that loads off the critical path
// (gate.ts). The server writes the card's markup into the slot; the page's island treats it
// as opaque HTML, and the chunk later hydrates it in a React root of its own, so loading it
// moves nothing and nothing in the island (re-renders, context updates) can disturb it.
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import type { IAnnouncementsSnapshot } from "@/models/Announcement";
import type { SlotState } from "./Card";
import type { CardRoot } from "./lazy";
import { homeItems, useSnapshot } from "./context";
import { whenNeeded } from "./gate";
import styles from "./styles";

export { AnnouncementsProvider } from "./context";

type LazyModule = typeof import("./lazy");

interface ServerMarkup {
  /** The snapshot the markup was rendered from: the dev server fetches a fresh one per request. */
  builtAt?: number;
  /** Per station page ("" elsewhere): a station's own announcements lead its card. */
  cards: Record<string, string>;
  bells: Record<string, string>;
}

// React can't render inside a render, so the card's and bells' markup is rendered beforehand
// (prepareAnnouncementsMarkup, from the page's frontmatter) and looked up while the island
// renders. Kept on globalThis: the build may load this module more than once.
const server = globalThis as { __announcementsMarkup?: ServerMarkup };
const markup = (): ServerMarkup => (server.__announcementsMarkup ??= { cards: {}, bells: {} });
const bellKey = (variant: string, station: string) => `${variant}:${station}`;

/** Server only: render the card (once per station page, once for the rest) and this page's station bells. */
export const prepareAnnouncementsMarkup = async (snapshot: IAnnouncementsSnapshot, stationSlug?: string) => {
  const { renderCard, renderBell } = await import("./ssr");
  if (markup().builtAt !== snapshot.built_at) {
    server.__announcementsMarkup = { builtAt: snapshot.built_at, cards: {}, bells: {} };
  }
  const m = markup();
  m.cards[stationSlug ?? ""] ??= homeItems(snapshot).length ? renderCard(snapshot) : "";
  if (stationSlug && hasStationAnnouncements(snapshot, stationSlug)) {
    for (const variant of ["header", "player"] as const) {
      m.bells[bellKey(variant, stationSlug)] ??= renderBell(snapshot, { stationSlug, stationTitle: "", variant });
    }
  }
};

/**
 * The chunk, retried until it loads. Until then the card simply stays the server markup
 * (its links work; taps on its buttons are held by gate.ts).
 */
let chunk: Promise<LazyModule> | null = null;
const loadChunk = (): Promise<LazyModule> =>
  (chunk ??= whenNeeded()
    .then(() => import("./lazy"))
    .catch(
      () =>
        new Promise<LazyModule>((resolve) => {
          const retry = () => {
            chunk = null;
            resolve(loadChunk());
          };
          if (navigator.onLine) setTimeout(retry, 10_000);
          else addEventListener("online", retry, { once: true });
        }),
    ));

/**
 * On the server: the prepared markup; in the browser: what the server left in the element. As
 * one dangerouslySetInnerHTML object for good: React 19 compares it by identity, and a new one
 * on a re-render would reset the element's HTML under the root that renders inside it.
 */
const useServerMarkup = (prepared: () => string | undefined, selector: string) =>
  useState(() => ({
    __html:
      typeof document === "undefined" ? (prepared() ?? "") : (document.querySelector(selector)?.innerHTML ?? ""),
  }))[0];

interface AnnouncementsProps {
  /** Above "Stații favorite:" (or the station list), in the favourites' column. */
  inHome?: boolean;
  /** Fill the parent (a page's own content column) instead of the 1230px station column. */
  inContent?: boolean;
  className?: string;
}

const CLEAR: SlotState = { empty: false, faded: false };
const SLOT = "[data-ann-r]";

/** The home announcements card (plus the page, form and station dialogs it hosts). */
function Announcements({ inHome = false, inContent = false, className = "" }: AnnouncementsProps) {
  const snapshot = useSnapshot();
  const hasHome = homeItems(snapshot).length > 0;
  const slotRef = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<SlotState>(CLEAR);
  const html = useServerMarkup(() => markup().cards[snapshot.station_slug ?? ""], SLOT);

  const onSlot = useCallback(
    (next: SlotState) => setSlot((prev) => (prev.empty === next.empty && prev.faded === next.faded ? prev : next)),
    [],
  );

  // One root for the card, hydrated over the server markup; a station change (RadioApp) shows
  // the new snapshot in it. Unmounted a task later: never while the page's own root commits.
  const card = useRef<CardRoot | null>(null);
  const hydrated = useRef(false);
  useEffect(() => {
    // the dialogs are needed even without a card: station sheets, shared #anunt/<slug> links
    if (!card.current && !snapshot.announcements.length && !location.hash.startsWith("#anunt/")) return;
    let cancelled = false;
    loadChunk().then((m) => {
      if (cancelled) return;
      setSlot(CLEAR);
      const current = card.current;
      if (current && current.container === slotRef.current) return current.show(snapshot);
      if (current) setTimeout(current.unmount);
      card.current = m.mountCard(slotRef.current, snapshot, onSlot, !hydrated.current);
      hydrated.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [snapshot, onSlot]);

  useEffect(
    () => () => {
      const current = card.current;
      if (current) setTimeout(current.unmount);
    },
    [],
  );

  if (!hasHome) return null;
  return (
    <div
      ref={slotRef}
      data-ann-r=""
      data-ann-pp=""
      className={`${styles.slot} ${inHome ? styles.inHome : ""} ${inContent ? styles.inContent : ""} ${slot.faded ? styles.faded : ""} ${className}`}
      hidden={slot.empty}
      dangerouslySetInnerHTML={html}
    />
  );
}

export default memo(Announcements);

interface BellProps {
  stationSlug: string;
  stationTitle: string;
  variant: "header" | "player";
}

const hasStationAnnouncements = (snapshot: IAnnouncementsSnapshot, station: string) =>
  snapshot.announcements.some((a) => a.station_slugs?.includes(station));

/** The station's bell (header or player bar); nothing when the station has no announcements. */
export const StationAnnouncementsBell = memo(function StationAnnouncementsBell(props: BellProps) {
  const snapshot = useSnapshot();
  const has = hasStationAnnouncements(snapshot, props.stationSlug);
  const ref = useRef<HTMLSpanElement>(null);
  const key = bellKey(props.variant, props.stationSlug);
  const html = useServerMarkup(() => markup().bells[key], `[data-ann-bell-root="${key}"]`);

  useEffect(() => {
    if (!has || !ref.current) return;
    let root: { unmount: () => void } | undefined;
    let cancelled = false;
    loadChunk().then((m) => {
      if (!cancelled && ref.current) root = m.mountBell(ref.current, snapshot, props);
    });
    return () => {
      cancelled = true;
      root?.unmount();
    };
    // the bell's identity is its station and place
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [has, key]);

  if (!has) return null;
  return (
    <span ref={ref} data-ann-bell-root={key} className={styles.bellRoot} dangerouslySetInnerHTML={html} />
  );
});
