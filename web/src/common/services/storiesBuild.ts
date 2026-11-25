// Build-time only: the stories listed by the API, for their share pages (/poveste/<slug>/).
// The backend rebuilds the website when a story is published or changed (services/web_deploy.py).
import type { IStory } from "@/models/Story";
import { ANNOUNCEMENTS_API_BASE } from "@/services/announcements";
import { timeoutSignal } from "@/services/http";

const BUILD_TIMEOUT_MS = 10_000;
const SAFE_SLUG = /^[a-z0-9-]{1,100}$/;
const isHttpUrl = (value: unknown): value is string => typeof value === "string" && /^https?:\/\//.test(value);

const toStory = (raw: any): IStory | null => {
  if (!raw || typeof raw !== "object" || !SAFE_SLUG.test(raw.slug ?? "") || typeof raw.title !== "string") {
    return null;
  }
  const slides = Array.isArray(raw.slides) ? raw.slides : [];
  return {
    slug: raw.slug,
    title: raw.title,
    cover_url: isHttpUrl(raw.cover_url) ? raw.cover_url : null,
    share_url: raw.share_url,
    slides: slides.map((slide: any) => ({
      id: slide.id,
      type: slide.type,
      media_url: isHttpUrl(slide.media_url) ? slide.media_url : null,
      poster_url: isHttpUrl(slide.poster_url) ? slide.poster_url : null,
    })),
  };
};

let stories: Promise<IStory[]> | null = null;

/** Every listed story; [] when the API can't be read (the pages then come with the next build). */
export const getStoriesForBuild = (): Promise<IStory[]> => {
  stories ??= (async () => {
    try {
      const response = await fetch(`${ANNOUNCEMENTS_API_BASE}/stories/`, {
        headers: { accept: "application/json" },
        signal: timeoutSignal(BUILD_TIMEOUT_MS),
      });
      if (!response.ok) {
        console.warn(`stories: HTTP ${response.status}, no share pages this build`);
        return [];
      }
      const body = await response.json();
      return (Array.isArray(body?.stories) ? body.stories : []).map(toStory).filter(Boolean) as IStory[];
    } catch (error) {
      console.warn(`stories: ${error instanceof Error ? error.message : error}, no share pages this build`);
      return [];
    }
  })();
  return stories;
};

/** The picture a share preview shows: the cover, else the first slide's image or poster. */
export const storyImage = (story: IStory): string | null =>
  story.cover_url
  ?? story.slides.map((slide) => (slide.type === "image" ? slide.media_url : slide.poster_url)).find(Boolean)
  ?? null;
