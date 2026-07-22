import type { PostHog } from "posthog-js";
import { classifyTrafficSource, type TrafficSource } from "@/utils/trafficSource";

const POSTHOG_KEY = "phc_9lTquHDSyoFxkYq4VPd8cFiQ21VZd627Lv8jSV8S7Fi";

// posthog-js (~58KB gzipped) is dynamically imported on idle so it stays out
// of the islands' hydration bundles. Events fired before it arrives are queued
// and flushed in order once init completes.
let client: PostHog | null = null;
let loadFailed = false;
let initialized = false;
const pending: Array<(ph: PostHog) => void> = [];

const withPostHog = (fn: (ph: PostHog) => void) => {
  if (client) fn(client);
  else if (!loadFailed) pending.push(fn);
};

export const initPostHog = () => {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;

  const load = () => {
    // Classified at entry: PostHog loads on idle, before any navigation could
    // rewrite document.referrer or the landing query string
    const traffic = classifyTrafficSource(
      document.referrer,
      new URLSearchParams(window.location.search),
      window.location.hostname,
    );

    import("posthog-js")
      .then(({ default: posthog }) => {
        posthog.init(POSTHOG_KEY, {
          api_host: "https://k.radiocrestin.ro",
          ui_host: "https://eu.posthog.com",
          defaults: "2026-01-30",
          person_profiles: "identified_only",
          autocapture: true,
          capture_pageview: true,
          capture_pageleave: true,
          persistence: "localStorage+cookie",
          session_idle_timeout_seconds: 14400, // 4 hours — keeps session alive during passive listening
          disable_surveys: true, // surveys unused — stops the 32KB surveys.js bundle from loading
          loaded: (ph) => {
            // Session-scoped so every event this visit carries the entry
            // channel, while the next visit re-attributes from scratch.
            // "internal" (own-domain referrer, e.g. station page → homepage)
            // keeps whatever the session already registered.
            if (traffic.source !== "internal") {
              ph.register_for_session({
                traffic_source: traffic.source,
                ...(traffic.detail && { traffic_source_detail: traffic.detail }),
              });
            }
          },
        });

        // Identify with the app's persistent user ID
        posthog.identify(getUserId());
        syncPersonSnapshot(posthog, traffic);

        client = posthog;
        pending.forEach((fn) => fn(posthog));
        pending.length = 0;
      })
      .catch(() => {
        // Chunk unreachable (offline, stale deploy) — analytics off for this page view
        loadFailed = true;
        pending.length = 0;
      });
  };

  // requestIdleCallback is unavailable on Safari/iOS — a large share of listeners
  if ("requestIdleCallback" in window) {
    requestIdleCallback(load, { timeout: 4000 });
  } else {
    setTimeout(load, 1500);
  }
};

const USER_ID_KEY = "radio_crestin_user_id";

export const getUserId = (): string => {
  if (typeof window === "undefined") return "";
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
};

const SORT_PREFERENCE_KEY = "station-sort-preference";
const FAVOURITES_STORE_KEY = "favourites-store"; // zustand persist key (useFavourite)
const SNAPSHOT_SYNCED_KEY = "ph_person_snapshot_synced";

const readFavoriteSlugs = (): string[] => {
  try {
    const raw = localStorage.getItem(FAVOURITES_STORE_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw)?.state?.favouriteItems;
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};

// Once per session, snapshot long-lived preferences onto the person profile so
// "what favourites / sort do users have" is answerable even for users who
// never touch those controls again. Later changes keep the properties fresh
// via $set piggybacked on favorite_toggled / sort_changed.
const syncPersonSnapshot = (ph: PostHog, traffic: TrafficSource) => {
  try {
    if (sessionStorage.getItem(SNAPSHOT_SYNCED_KEY) === "1") return;
    sessionStorage.setItem(SNAPSHOT_SYNCED_KEY, "1");
  } catch {
    // sessionStorage unavailable — sync anyway (worst case: once per pageview)
  }
  const favorites = readFavoriteSlugs();
  const isEntry = traffic.source !== "internal";
  ph.setPersonProperties(
    {
      favorite_stations: favorites,
      favorite_count: favorites.length,
      station_sort: localStorage.getItem(SORT_PREFERENCE_KEY) || "recommended",
      // Last-touch channel, GA-style "last non-direct": a plain direct visit
      // never overwrites a known acquisition source
      ...(isEntry && traffic.source !== "direct" && { last_traffic_source: traffic.source }),
    },
    // First-touch — $set_once writes only if the person doesn't have it yet
    isEntry ? { initial_traffic_source: traffic.source } : undefined,
  );
};

const serializeError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    const json = JSON.stringify(error);
    return json === "{}" ? `[${typeof error}] (empty object)` : json;
  } catch {
    return String(error);
  }
};

export const captureException = (error: unknown, context?: string) => {
  const original = error instanceof Error ? error : new Error(serializeError(error));
  const message = context ? `${context}: ${original.message}` : original.message;

  // Create a new Error at this call site so PostHog gets a useful stack trace.
  // The original error (e.g. TypeError from fetch) often has an empty/browser-internal stack.
  const err = new Error(message, { cause: original });
  err.name = original.name;
  // Keep the NEW error's stack (points to our code) — don't overwrite with the original's
  withPostHog((ph) => ph.captureException(err));
};

export const trackStationOpened = (stationSlug: string, stationName: string, stationId?: number) => {
  withPostHog((ph) => ph.capture("station_opened", {
    station_slug: stationSlug,
    station_name: stationName,
    ...(stationId != null && { station_id: stationId }),
  }));
};

export const trackFavoriteToggled = (
  stationSlug: string,
  isFavorite: boolean,
  stationId?: number,
  allFavorites?: string[],
) => {
  withPostHog((ph) => ph.capture("favorite_toggled", {
    station_slug: stationSlug,
    is_favorite: isFavorite,
    ...(stationId != null && { station_id: stationId }),
    // Keep the person profile's favourites list current so "which stations
    // do users favourite most" can be answered from person properties
    ...(allFavorites && {
      $set: { favorite_stations: allFavorites, favorite_count: allFavorites.length },
    }),
  }));
};

/** @deprecated Use trackFavoriteToggled */
export const trackFavouriteToggled = trackFavoriteToggled;

export const trackListeningStarted = (stationSlug: string, stationName: string, stationId?: number) => {
  withPostHog((ph) => ph.capture("listening_started", {
    station_slug: stationSlug,
    station_name: stationName,
    ...(stationId != null && { station_id: stationId }),
  }));
};

/** @deprecated Use trackListeningStarted */
export const trackListeningStart = trackListeningStarted;

export const trackListeningStopped = (
  stationSlug: string,
  stationName: string,
  durationSeconds: number,
  reason: string = "stop",
  stationId?: number,
) => {
  withPostHog((ph) => ph.capture("listening_stopped", {
    station_slug: stationSlug,
    station_name: stationName,
    duration_seconds: Math.round(durationSeconds),
    reason,
    ...(stationId != null && { station_id: stationId }),
  }));
};

/** @deprecated Use trackListeningStopped */
export const trackListeningStop = trackListeningStopped;

export const trackListeningStoppedBeacon = (
  stationSlug: string,
  stationName: string,
  durationSeconds: number,
  reason: string = "tab_closed",
  stationId?: number,
) => {
  withPostHog((ph) => ph.capture("listening_stopped", {
    station_slug: stationSlug,
    station_name: stationName,
    duration_seconds: Math.round(durationSeconds),
    reason,
    ...(stationId != null && { station_id: stationId }),
  }, { transport: "sendBeacon" }));
};


export type ShareChannel = "whatsapp" | "facebook" | "telegram" | "copy_link" | "native";
export type ShareSource = "hero" | "player_menu";

export const trackShareCompleted = (
  stationSlug: string,
  stationName: string,
  channel: ShareChannel,
  source: ShareSource,
  stationId?: number,
) => {
  withPostHog((ph) => ph.capture("share_completed", {
    station_slug: stationSlug,
    station_name: stationName,
    channel,
    source,
    ...(stationId != null && { station_id: stationId }),
  }));
};

export const trackSearchPerformed = (
  query: string,
  resultsCount: number,
  source: "typed" | "url" = "typed",
) => {
  withPostHog((ph) => ph.capture("search_performed", {
    query,
    results_count: resultsCount,
    has_results: resultsCount > 0,
    source,
  }));
};

export const trackStationUnreachable = (
  stationSlug: string,
  stationName: string,
  streamType?: string | null,
  stationId?: number,
) => {
  withPostHog((ph) => ph.capture("station_unreachable", {
    station_slug: stationSlug,
    station_name: stationName,
    ...(streamType && { stream_type: streamType }),
    ...(stationId != null && { station_id: stationId }),
  }));
};

export const trackSortChanged = (sortBy: string) => {
  withPostHog((ph) => ph.capture("sort_changed", {
    sort_by: sortBy,
    // Mirror onto the person profile — answers "what sort do users have"
    $set: { station_sort: sortBy },
  }));
};

export const trackWhatsAppVerseClicked = () => {
  withPostHog((ph) => ph.capture("whatsapp_verse_clicked"));
};

export const trackWhatsAppVerseDismissed = () => {
  withPostHog((ph) => ph.capture("whatsapp_verse_dismissed"));
};

export const trackReviewSubmitted = (
  stationSlug: string,
  stationName: string,
  stars: number,
  stationId?: number,
  songId?: number,
) => {
  withPostHog((ph) => ph.capture("review_submitted", {
    station_slug: stationSlug,
    station_name: stationName,
    stars,
    ...(stationId != null && { station_id: stationId }),
    ...(songId != null && { song_id: songId }),
  }));
};
