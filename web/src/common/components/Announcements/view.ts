// Which announcements show, once the announcements code has loaded (lazy chunk). The result is
// the pre-paint script's (window.__ann), so taking over from the server markup changes nothing.
import { useLayoutEffect, useMemo, useState } from "react";
import { create } from "zustand";
import type { IAnnouncementsSnapshot } from "@/models/Announcement";
import {
  fetchAnnouncementsFeed,
  fetchAnnouncementsPreview,
  fetchCountry,
  startFlushingAnnouncementEvents,
} from "@/services/announcements";
import useAnnouncementsStore from "@/store/useAnnouncementsStore";
import { stationFirst } from "@/utils/announcements";
import {
  annEligibility,
  LEGACY_DISMISSED_KEY,
  MOBILE_QUERY,
  toPrepaintData,
  type PrepaintFeed,
  type PrepaintResult,
} from "@/utils/announcementsPrepaint";
import { useSnapshot } from "./context";

const FEED_KEY = "announcements-feed";
const PREVIEW_PARAM = "anunturi-preview";

interface View {
  result: PrepaintResult | null;
  mobile: boolean;
  removed: Set<string>;
  /** Unpublished announcements for ?anunturi-preview, replacing the snapshot. */
  preview: IAnnouncementsSnapshot | null;
}

const useView = create<View>(() => ({ result: null, mobile: false, removed: new Set(), preview: null }));

/** A JSON value from localStorage, read the way the pre-paint script reads it. */
const readStored = <T,>(key: string): T | null => {
  try {
    return JSON.parse(localStorage.getItem(key)!);
  } catch {
    return null;
  }
};

/** The same computation the pre-paint script ran, for when it couldn't (or for a preview). */
const computeEligibility = (snapshot: IAnnouncementsSnapshot): PrepaintResult =>
  annEligibility(
    toPrepaintData(snapshot),
    { ...useAnnouncementsStore.getState(), w: readStored(LEGACY_DISMISSED_KEY) },
    readStored<PrepaintFeed>(FEED_KEY),
    navigator.language.toLowerCase(),
    Date.now(),
    Math.random(),
  );

/** Store the fresh list (it can only remove items, on the next load) and learn the country. */
const refreshInBackground = async () => {
  const feed = await fetchAnnouncementsFeed();
  if (feed) {
    const stored: PrepaintFeed = { t: Date.now(), s: feed.announcements.map((a) => a.slug) };
    try {
      localStorage.setItem(FEED_KEY, JSON.stringify(stored));
    } catch {
      // storage full or blocked: removals then wait for the next deploy
    }
  }
  const store = useAnnouncementsStore.getState();
  if (store.country === undefined) {
    const country = await fetchCountry();
    if (country !== undefined) store.setCountry(country);
  }
};

/** Rotate mode starts one slide further on the next load (or station change). */
const advanceRotationIfShown = (snapshot: IAnnouncementsSnapshot, result: PrepaintResult) => {
  if (result.m.h.length + result.d.h.length && snapshot.settings.rotation_mode === "rotate") {
    useAnnouncementsStore.getState().advanceRotation();
  }
};

/** The snapshot `result` was decided for; null until the first component takes over. */
let decidedFor: IAnnouncementsSnapshot | null = null;

/** Once per page view, when the first announcements component takes over. */
const start = (snapshot: IAnnouncementsSnapshot) => {
  decidedFor = snapshot;
  const prepainted = (window as unknown as { __ann?: PrepaintResult }).__ann;
  const result = prepainted ?? computeEligibility(snapshot);
  const query = window.matchMedia(MOBILE_QUERY);
  useView.setState({ result, mobile: query.matches });
  query.addEventListener("change", () => useView.setState({ mobile: query.matches }));
  advanceRotationIfShown(snapshot, result);

  startFlushingAnnouncementEvents();
  const token = new URLSearchParams(location.search).get(PREVIEW_PARAM);
  if (token) {
    fetchAnnouncementsPreview(token).then((preview) => {
      if (!preview) return;
      const snapshotOfPreview = stationFirst({ ...preview, built_at: Date.now() }, snapshot.station_slug);
      useView.setState({ preview: snapshotOfPreview, result: computeEligibility(snapshotOfPreview) });
    });
  } else {
    refreshInBackground();
  }
};

/**
 * Another station (or the home page) without a page load (RadioApp): decided again, as a new
 * load would, so the home card also moves on to its next announcement.
 */
const decideAgain = (snapshot: IAnnouncementsSnapshot) => {
  decidedFor = snapshot;
  if (useView.getState().preview) return;
  const result = computeEligibility(snapshot);
  useView.setState({ result });
  advanceRotationIfShown(snapshot, result);
};

const decideFor = (snapshot: IAnnouncementsSnapshot) => {
  if (!decidedFor) start(snapshot);
  else if (snapshot !== decidedFor) decideAgain(snapshot);
};

/**
 * The snapshot and what may show. On its first render a component matches the server markup
 * (visible = null); it takes over in a layout effect, before the browser paints.
 */
export const useAnnouncements = () => {
  const built = useSnapshot();
  const [live, setLive] = useState(false);
  useLayoutEffect(() => {
    decideFor(built);
    setLive(true);
  }, [built]);

  const { result, mobile, removed, preview } = useView();
  const snapshot = preview ?? built;
  const view = live && result ? result[mobile ? "m" : "d"] : null;
  const visible = useMemo(
    () => (view ? new Set(view.v.filter((slug) => !removed.has(slug))) : null),
    [view, removed],
  );
  return { snapshot, visible, start: view?.k ?? 0, remove: removeAnnouncement };
};

/** Takes an announcement out of this page view. */
export const removeAnnouncement = (slug: string) =>
  useView.setState((s) => ({ removed: new Set(s.removed).add(slug) }));
