// Stories API (backend/docs/stories-api.md) for the share page /poveste/<slug>/: the list once at
// build time (a static page per listed story, with its share preview), and one story by slug in
// the browser (a fresh copy, and the stories built after the last deploy).
import type { IStory } from "@/models/Story";
import { API_BASE, isTransientHttpStatus, parseJsonOrThrowTransient, timeoutSignal } from "@/services/http";
import { STORY_SLUG, isStoryLive, toStoryBubbles, toStoryView, type StoryBubble, type StoryView } from "@/utils/stories";

// Lets local development and the tests point at a local backend or a mock server.
export const STORIES_API_BASE: string =
  import.meta.env.PUBLIC_STORIES_API_BASE || import.meta.env.PUBLIC_ANNOUNCEMENTS_API_BASE || API_BASE;

const BUILD_TIMEOUT_MS = 10_000;

/** The list as the build reads it, or null; read once per build (every page shares it). */
const buildCache = globalThis as { __storiesList?: Promise<unknown> };
const readListForBuild = (): Promise<unknown> => {
  if (import.meta.env.MODE === "development") delete buildCache.__storiesList; // fresh on every dev render
  const url = `${STORIES_API_BASE}/stories/`;
  return (buildCache.__storiesList ??= (async () => {
    try {
      const response = await fetch(url, { headers: { accept: "application/json" }, signal: timeoutSignal(BUILD_TIMEOUT_MS) });
      if (!response.ok) {
        console.warn(`[stories] ${url} answered HTTP ${response.status}: no stories in this build`);
        return null;
      }
      return await parseJsonOrThrowTransient(response);
    } catch (error) {
      console.warn(`[stories] ${url} unreadable at build time: ${error}: no stories in this build`);
      return null;
    }
  })());
};

/**
 * The listed stories that are live now, as page views. Never fails the build: a story without a
 * static page is still shown by the fallback (/poveste/?s=<slug>, reached from the 404 page).
 */
export const getStoriesForBuild = async (): Promise<StoryView[]> => {
  const data = (await readListForBuild()) as { stories?: IStory[] } | null;
  const stories: IStory[] = Array.isArray(data?.stories) ? data.stories : [];
  return stories.filter((s) => isStoryLive(s)).flatMap((s) => toStoryView(s) ?? []);
};

/** The bar's bubbles as the build sees them (server-rendered above the announcements). */
export const getStoryBubblesForBuild = async (): Promise<StoryBubble[]> => toStoryBubbles(await readListForBuild());

/** The fresh list's bubbles after load (CDN-cached), or null when it can't be read. */
export const fetchStoryBubbles = async (): Promise<StoryBubble[] | null> => {
  try {
    const response = await fetch(`${STORIES_API_BASE}/stories/`, { headers: { accept: "application/json" }, signal: timeoutSignal(8000) });
    if (!response.ok) return null;
    return toStoryBubbles(await parseJsonOrThrowTransient(response));
  } catch {
    return null;
  }
};

const storyCache = new Map<string, Promise<StoryView | "gone" | "error">>();
/** fetchStory, once per page view (a bubble prefetches it on hover / touch); errors aren't kept. */
export const fetchStoryCached = (slug: string): Promise<StoryView | "gone" | "error"> => {
  let pending = storyCache.get(slug);
  if (!pending) {
    pending = fetchStory(slug).then((result) => {
      if (result === "error") storyCache.delete(slug);
      return result;
    });
    storyCache.set(slug, pending);
  }
  return pending;
};

/** One story: its view, "gone" (unknown, expired or empty), or "error" (couldn't ask). */
export const fetchStory = async (slug: string, timeoutMs = 8000): Promise<StoryView | "gone" | "error"> => {
  if (!STORY_SLUG.test(slug)) return "gone";
  try {
    const response = await fetch(`${STORIES_API_BASE}/stories/${slug}/`, {
      headers: { accept: "application/json" },
      signal: timeoutSignal(timeoutMs),
    });
    if (response.status === 404 || response.status === 410) return "gone";
    if (!response.ok) return isTransientHttpStatus(response.status) ? "error" : "gone";
    const data = await parseJsonOrThrowTransient(response);
    if (!data || !isStoryLive(data)) return "gone";
    return toStoryView(data) ?? "gone";
  } catch {
    return "error";
  }
};

export type StoryEventType = "view" | "slide_view" | "complete" | "like" | "unlike" | "cta_click" | "share";
export interface StoryEvent {
  type: StoryEventType;
  story: string;
  slide?: number;
  target?: "button" | "swipe_up";
}
export interface StoryEventsAnswer {
  like_counts?: Record<string, number>;
  liked?: string[];
}

/** Reports events (POST /stories/events/); the answer carries fresh like counts, or null. */
export const sendStoryEvents = async (events: StoryEvent[], deviceId: string): Promise<StoryEventsAnswer | null> => {
  if (!events.length || !deviceId) return null;
  const at = new Date().toISOString();
  try {
    const response = await fetch(`${STORIES_API_BASE}/stories/events/`, {
      method: "POST",
      // text/plain: a "simple" request, no CORS preflight (the contract accepts any Content-Type).
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({
        device_id: deviceId,
        platform: "web",
        locale: typeof navigator !== "undefined" ? navigator.language : undefined,
        events: events.map((e) => ({ ...e, at })),
      }),
      keepalive: true,
      signal: timeoutSignal(8000),
    });
    if (!response.ok) return null;
    return (await parseJsonOrThrowTransient(response)) as StoryEventsAnswer | null;
  } catch {
    return null;
  }
};

