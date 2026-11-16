// Announcements API (see the shared announcements SPEC): the list (one snapshot at build time,
// a fresh copy after load), one announcement by slug, the country, and batched events.
import type {
  AnnouncementEventType,
  ClickTarget,
  IAnnouncement,
  IAnnouncementEvent,
  IAnnouncementsResponse,
  IAnnouncementsSnapshot,
} from "@/models/Announcement";
import { captureException, getUserId, trackAnnouncement } from "@/utils/posthog";
import { placementOf } from "@/utils/announcements";
import { SAFE_SLUG } from "@/utils/announcementsPrepaint";
import {
  API_BASE,
  isTransient,
  isTransientHttpStatus,
  parseJsonOrThrowTransient,
  timeoutSignal,
} from "@/services/http";

// Lets local development point at a local backend or a mock server.
export const ANNOUNCEMENTS_API_BASE: string =
  import.meta.env.PUBLIC_ANNOUNCEMENTS_API_BASE || API_BASE;

const MAX_EVENTS_PER_REQUEST = 100;
const BUILD_TIMEOUT_MS = 2000;
export const EVENTS_FLUSH_INTERVAL_MS = 5000;

export const EMPTY_ANNOUNCEMENTS: IAnnouncementsResponse = {
  settings: { rotation_mode: "fixed" },
  announcements: [],
};

const LIST_URL = `${ANNOUNCEMENTS_API_BASE}/announcements/`;
const EVENTS_URL = `${ANNOUNCEMENTS_API_BASE}/announcements/events/`;

const clientContext = () => ({
  device_id: getUserId(),
  platform: "web",
  locale: navigator.language,
});

const fetchJson = async (endpoint: string, init: RequestInit = {}, timeoutMs = 5000): Promise<any> => {
  const response = await fetch(endpoint, {
    headers: { accept: "application/json" },
    signal: timeoutSignal(timeoutMs),
    ...init,
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    if (isTransientHttpStatus(response.status)) return null;
    const body = await response.text().catch(() => "(unreadable)");
    throw new Error(`HTTP ${response.status} from ${endpoint}: ${body}`);
  }
  return parseJsonOrThrowTransient(response);
};

const reportUnlessTransient = (error: unknown, context: string) => {
  if (!isTransient(error)) captureException(error, context);
};

// Slugs become CSS selectors and data attributes: drop items whose slug isn't plain.
const toResponse = (data: any): IAnnouncementsResponse | null =>
  data && Array.isArray(data.announcements)
    ? {
        settings: { ...EMPTY_ANNOUNCEMENTS.settings, ...data.settings },
        announcements: data.announcements.filter((a: IAnnouncement) => SAFE_SLUG.test(a?.slug ?? "")),
      }
    : null;

/**
 * The list as it is at build time, rendered into the HTML. One request per build;
 * a slow or failing API gives an empty snapshot instead of a slow build.
 */
// Kept on globalThis: the build may load this module more than once (layout and page chunks),
// and the inline script and the island must see exactly the same snapshot.
const buildCache = globalThis as { __announcementsSnapshot?: Promise<IAnnouncementsSnapshot> };
export const getAnnouncementsSnapshot = (): Promise<IAnnouncementsSnapshot> => {
  // The dev server renders on every request: fetch fresh there instead of once per process.
  if (import.meta.env.MODE === "development") delete buildCache.__announcementsSnapshot;
  return (buildCache.__announcementsSnapshot ??= fetchJson(LIST_URL, {}, BUILD_TIMEOUT_MS)
    .catch(() => null)
    .then((data) => ({ ...(toResponse(data) ?? EMPTY_ANNOUNCEMENTS), built_at: Date.now() })));
};

/** The fresh list (the same for everyone, CDN-cached); null when it can't be read. */
export const fetchAnnouncementsFeed = async (): Promise<IAnnouncementsResponse | null> => {
  try {
    return toResponse(await fetchJson(LIST_URL));
  } catch (error) {
    reportUnlessTransient(error, "fetchAnnouncementsFeed failed");
    return null;
  }
};

/** Unpublished announcements for `?anunturi-preview=<token>` (never cached). */
export const fetchAnnouncementsPreview = async (token: string): Promise<IAnnouncementsResponse | null> => {
  try {
    return toResponse(await fetchJson(`${LIST_URL}?preview=${encodeURIComponent(token)}`, { cache: "no-store" }));
  } catch {
    return null;
  }
};

export const getAnnouncement = async (slug: string): Promise<IAnnouncement | null> => {
  const endpoint = `${LIST_URL}${encodeURIComponent(slug)}/`;
  try {
    const data = await fetchJson(endpoint);
    return data?.slug ? data : null;
  } catch (error) {
    reportUnlessTransient(error, `getAnnouncement failed [${slug}]`);
    return null;
  }
};

/**
 * Sends an empty event batch to learn the visitor's country (from Cloudflare).
 * Returns undefined when the request fails, null when Cloudflare doesn't know.
 */
export const fetchCountry = async (): Promise<string | null | undefined> => {
  try {
    const data = await fetchJson(EVENTS_URL, {
      method: "POST",
      body: new Blob([JSON.stringify({ ...clientContext(), events: [] })], { type: "text/plain" }),
    });
    return data ? (data.country ?? null) : undefined;
  } catch {
    return undefined;
  }
};

// text/plain keeps sendBeacon (and the fetch fallback) a "simple" CORS request: no preflight.
export const postAnnouncementEvents = (events: IAnnouncementEvent[]): void => {
  const url = EVENTS_URL;
  const body = JSON.stringify({ ...clientContext(), events });
  const blob = new Blob([body], { type: "text/plain" });
  if (navigator.sendBeacon?.(url, blob)) return;
  fetch(url, { method: "POST", body: blob, keepalive: true }).catch(() => {});
};

/** The form page; device context goes in the fragment, which never reaches the server or cache. */
export const formPageUrl = (slug: string, theme: "dark" | "light"): string => {
  const context = new URLSearchParams({ device_id: getUserId(), platform: "web", locale: navigator.language });
  return `${ANNOUNCEMENTS_API_BASE}/forms/${encodeURIComponent(slug)}/page/?theme=${theme}#${context}`;
};

export interface EventQueue {
  push: (event: IAnnouncementEvent) => void;
  flush: () => void;
  size: () => number;
}

export const createEventQueue = (
  send: (events: IAnnouncementEvent[]) => void,
  maxBatch: number = MAX_EVENTS_PER_REQUEST,
): EventQueue => {
  const pending: IAnnouncementEvent[] = [];
  return {
    push: (event) => {
      pending.push(event);
    },
    flush: () => {
      while (pending.length) send(pending.splice(0, maxBatch));
    },
    size: () => pending.length,
  };
};

export const announcementEvents = createEventQueue(postAnnouncementEvents);

/** Flushes every few seconds and whenever the page is hidden. Returns a cleanup. */
export const startFlushingAnnouncementEvents = (queue: EventQueue = announcementEvents) => {
  const flush = () => queue.flush();
  const flushIfHidden = () => {
    if (document.visibilityState === "hidden") flush();
  };
  const timer = window.setInterval(flush, EVENTS_FLUSH_INTERVAL_MS);
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", flushIfHidden);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("pagehide", flush);
    document.removeEventListener("visibilitychange", flushIfHidden);
    flush();
  };
};

export interface AnnouncementEventContext {
  position: number;
  /** For `clicked`: whether the whole card, its button or a link in its description was tapped. */
  target?: ClickTarget | null;
  /** For a `clicked` on a link in the description: where it goes. */
  linkUrl?: string;
  /** Defaults to the primary button's action type. */
  actionType?: string | null;
  /** The station page or player the announcement was shown in. */
  stationSlug?: string | null;
  /** For video_play: the embed's provider and kind. */
  video?: { provider: "youtube"; kind: string };
}

/** Queues the event for the backend and captures it in PostHog. */
export const recordAnnouncementEvent = (
  announcement: IAnnouncement,
  type: AnnouncementEventType,
  context: AnnouncementEventContext,
  queue: EventQueue = announcementEvents,
) => {
  const target = context.target ?? null;
  const placement = placementOf(announcement);
  const stationSlug = context.stationSlug ?? null;
  queue.push({
    slug: announcement.slug,
    type,
    position: context.position,
    target,
    placement,
    station_slug: stationSlug,
    ...context.video,
    at: new Date().toISOString(),
  });
  trackAnnouncement(type, {
    announcement_slug: announcement.slug,
    announcement_category: announcement.category?.slug ?? null,
    action_type: context.actionType ?? announcement.button?.action?.type ?? null,
    position: context.position,
    platform: "web",
    target,
    placement,
    station_slug: stationSlug,
    ...(context.video && { video_provider: context.video.provider, video_kind: context.video.kind }),
    ...(context.linkUrl && { link_url: context.linkUrl }),
  });
  if (type === "clicked") queue.flush();
};
