import type { PostHog } from "posthog-js";

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
        });

        // Identify with the app's persistent user ID
        posthog.identify(getUserId());

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

export const trackFavoriteToggled = (stationSlug: string, isFavorite: boolean, stationId?: number) => {
  withPostHog((ph) => ph.capture("favorite_toggled", {
    station_slug: stationSlug,
    is_favorite: isFavorite,
    ...(stationId != null && { station_id: stationId }),
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
