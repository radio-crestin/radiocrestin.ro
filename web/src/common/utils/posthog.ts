import posthog from "posthog-js";

const POSTHOG_KEY = "phc_9lTquHDSyoFxkYq4VPd8cFiQ21VZd627Lv8jSV8S7Fi";

let initialized = false;

export const initPostHog = () => {
  if (typeof window === "undefined" || initialized) return;

  posthog.init(POSTHOG_KEY, {
    api_host: "https://k.radiocrestin.ro",
    ui_host: "https://eu.posthog.com",
    defaults: "2026-01-30",
    person_profiles: "identified_only",
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
  });

  // Identify with the app's persistent user ID
  const userId = getUserId();
  posthog.identify(userId);

  initialized = true;
};

const getUserId = (): string => {
  const storageKey = "radio_crestin_user_id";
  let userId = localStorage.getItem(storageKey);
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(storageKey, userId);
  }
  return userId;
};

export const captureException = (error: Error) => {
  posthog.captureException(error);
};

export const trackStationOpened = (stationSlug: string, stationTitle: string) => {
  posthog.capture("station_opened", {
    station_slug: stationSlug,
    station_title: stationTitle,
  });
};

export const trackFavouriteToggled = (stationSlug: string, isFavourite: boolean) => {
  posthog.capture("favourite_toggled", {
    station_slug: stationSlug,
    is_favourite: isFavourite,
  });
};

export const trackListeningStart = (stationSlug: string, stationTitle: string) => {
  posthog.capture("listening_start", {
    station_slug: stationSlug,
    station_title: stationTitle,
  });
};

export const trackListeningStop = (
  stationSlug: string,
  stationTitle: string,
  durationSeconds: number,
) => {
  posthog.capture("listening_stop", {
    station_slug: stationSlug,
    station_title: stationTitle,
    duration_seconds: Math.round(durationSeconds),
  });
};

export const trackReviewSubmitted = (
  stationSlug: string,
  stationTitle: string,
  stars: number,
) => {
  posthog.capture("review_submitted", {
    station_slug: stationSlug,
    station_title: stationTitle,
    stars,
  });
};

export { posthog };
