// Stories API (backend/docs/stories-api.md) for the share page /poveste/<slug>/: the list once at
// build time (a static page per listed story, with its share preview), and one story by slug in
// the browser (a fresh copy, and the stories built after the last deploy).
import type { IStory } from "@/models/Story";
import { API_BASE, isTransientHttpStatus, parseJsonOrThrowTransient, timeoutSignal } from "@/services/http";
import { STORY_SLUG, isStoryLive, toStoryView, type StoryView } from "@/utils/stories";

// Lets local development and the tests point at a local backend or a mock server.
export const STORIES_API_BASE: string =
  import.meta.env.PUBLIC_STORIES_API_BASE || import.meta.env.PUBLIC_ANNOUNCEMENTS_API_BASE || API_BASE;

const BUILD_TIMEOUT_MS = 10_000;

/**
 * The listed stories that are live now, as page views. Never fails the build: a story without a
 * static page is still shown by the fallback (/poveste/?s=<slug>, reached from the 404 page).
 */
export const getStoriesForBuild = async (): Promise<StoryView[]> => {
  const url = `${STORIES_API_BASE}/stories/`;
  try {
    const response = await fetch(url, { headers: { accept: "application/json" }, signal: timeoutSignal(BUILD_TIMEOUT_MS) });
    if (!response.ok) {
      console.warn(`[stories] ${url} answered HTTP ${response.status}: no static story pages`);
      return [];
    }
    const data = await parseJsonOrThrowTransient(response);
    const stories: IStory[] = Array.isArray(data?.stories) ? data.stories : [];
    return stories.filter((s) => isStoryLive(s)).flatMap((s) => toStoryView(s) ?? []);
  } catch (error) {
    console.warn(`[stories] ${url} unreadable at build time: ${error}: no static story pages`);
    return [];
  }
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
