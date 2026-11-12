// The announcements entry the pages and apps import. It stays tiny: the card, the bells, the
// dialogs and the event code are a separate chunk (lazy.tsx) that loads off the critical path
// (gate.ts). The server writes the card's markup into the slot; the page's island treats it
// as opaque HTML, and the chunk later hydrates it in a React root of its own, so loading it
// moves nothing and nothing in the island (re-renders, context updates) can disturb it.
import React, { memo, useEffect, useRef, useState } from "react";
import type { IAnnouncementsSnapshot } from "@/models/Announcement";
import type { SlotState } from "./Card";
import { homeItems, useSnapshot } from "./context";
import { whenNeeded } from "./gate";
import styles from "./styles";

export { AnnouncementsProvider } from "./context";

type LazyModule = typeof import("./lazy");

interface ServerMarkup {
  /** The snapshot the markup was rendered from: the dev server fetches a fresh one per request. */
  builtAt?: number;
  card?: string;
  bells: Record<string, string>;
}

// React can't render inside a render, so the card's and bells' markup is rendered beforehand
// (prepareAnnouncementsMarkup, from the page's frontmatter) and looked up while the island
// renders. Kept on globalThis: the build may load this module more than once.
const server = globalThis as { __announcementsMarkup?: ServerMarkup };
const markup = (): ServerMarkup => (server.__announcementsMarkup ??= { bells: {} });
const bellKey = (variant: string, station: string) => `${variant}:${station}`;

/** Server only: render the card (once per build) and this page's station bells. */
export const prepareAnnouncementsMarkup = async (snapshot: IAnnouncementsSnapshot, stationSlug?: string) => {
  const { renderCard, renderBell } = await import("./ssr");
  if (markup().builtAt !== snapshot.built_at) server.__announcementsMarkup = { builtAt: snapshot.built_at, bells: {} };
  const m = markup();
  if (m.card === undefined) m.card = homeItems(snapshot).length ? renderCard(snapshot) : "";
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

/** On the server: the prepared markup; in the browser: what the server left in the element. */
const useServerMarkup = (prepared: () => string | undefined, selector: string) =>
  useState(() =>
    typeof document === "undefined" ? (prepared() ?? "") : (document.querySelector(selector)?.innerHTML ?? ""),
  )[0];

interface AnnouncementsProps {
  /** The first, full-width item of the station list. */
  inGrid?: boolean;
  /** Fill the parent (a page's own content column) instead of the 1230px station column. */
  inContent?: boolean;
  /** Not shown (e.g. while the station list is being searched). */
  hidden?: boolean;
  className?: string;
}

const CLEAR: SlotState = { empty: false, faded: false };
const SLOT = "[data-ann-r]";

/** The home announcements card (plus the page, form and station dialogs it hosts). */
function Announcements({ inGrid = false, inContent = false, hidden = false, className = "" }: AnnouncementsProps) {
  const snapshot = useSnapshot();
  const hasHome = homeItems(snapshot).length > 0;
  const slotRef = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<SlotState>(CLEAR);
  const html = useServerMarkup(() => markup().card, SLOT);

  useEffect(() => {
    // the dialogs are needed even without a card: station sheets, shared #anunt/<slug> links
    if (!snapshot.announcements.length && !location.hash.startsWith("#anunt/")) return;
    let root: { unmount: () => void } | undefined;
    let cancelled = false;
    loadChunk().then((m) => {
      if (cancelled) return;
      root = m.mountCard(slotRef.current, snapshot, (next) =>
        setSlot((prev) => (prev.empty === next.empty && prev.faded === next.faded ? prev : next)),
      );
    });
    return () => {
      cancelled = true;
      root?.unmount();
    };
  }, [snapshot]);

  if (!hasHome) return null;
  return (
    <div
      ref={slotRef}
      data-ann-r=""
      data-ann-pp=""
      className={`${styles.slot} ${inGrid ? styles.inGrid : ""} ${inContent ? styles.inContent : ""} ${slot.faded ? styles.faded : ""} ${className}`}
      hidden={hidden || slot.empty}
      dangerouslySetInnerHTML={{ __html: html }}
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
    <span ref={ref} data-ann-bell-root={key} className={styles.bellRoot} dangerouslySetInnerHTML={{ __html: html }} />
  );
});
