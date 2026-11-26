// The story share page (/poveste/<slug>/): what the API's story becomes on the website.
// Pure functions, shared by the build (static pages, Open Graph) and the browser (fresh copy).
// Unknown slide types and slides without what their type needs are skipped, per the contract
// (backend/docs/stories-api.md, "Unknown values"); every link is checked before it's rendered.
import type { IStory, IStoryCta, IStorySlide } from "@/models/Story";
import { ANDROID_PACKAGE, SITE_URL, getAndroidStoreLink, getIOSStoreLink } from "@/constants/constants";

export const STORY_SLUG = /^[a-z0-9-]{1,100}$/;
export const STORY_PATH = /^\/poveste\/([a-z0-9-]{1,100})\/?$/;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export type StoryMedia =
  | { kind: "image"; src: string }
  | { kind: "video"; src: string; poster?: string }
  | { kind: "youtube"; videoId: string; url: string; thumbnail: string; title?: string }
  | { kind: "instagram"; url: string; embedUrl: string; thumbnail?: string; author?: string; caption?: string };

export interface StoryLink {
  /** As in the app: a button, a "swipe up" hint with the label, or both. */
  style: "button" | "swipe_up" | "both";
  label: string;
  /** CSS colours of the button and its label, when the admin set them. */
  color?: string;
  textColor?: string;
  href: string;
  /** Leaves the site: opens in a new tab. */
  external: boolean;
}

export interface StorySlideView {
  id: number;
  media: StoryMedia;
  /** Framed sideways: letterboxed, never cropped. */
  landscape: boolean;
  /** Seconds on screen (a video runs for its own length). */
  duration: number;
  hasSound: boolean;
  cta: StoryLink | null;
  caption: string | null;
}

export interface StoryView {
  slug: string;
  title: string;
  cover: string | null;
  shareUrl: string;
  /** Changes when the admin edits the story: a seen story with a newer one is new again. */
  updatedAt: string;
  likeCount: number;
  /** Who it's from, under the CTA; null: the app shows the title there. */
  author: { name: string; avatar: string | null } | null;
  /** Messages to the team: the field shows only when enabled. */
  messages: { enabled: boolean; placeholder: string };
  slides: StorySlideView[];
}

export const DEFAULT_MESSAGE_PLACEHOLDER = "Trimite un mesaj…";

export const DEFAULT_SLIDE_SECONDS = 6;
const slideSeconds = (raw: unknown) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.max(n, 2), 60) : DEFAULT_SLIDE_SECONDS;
};

/** An http(s) URL without credentials, or null. */
export const safeHttpUrl = (raw: unknown): string | null => {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const url = new URL(raw);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
};

/** A count as the app shows it, with Romanian thousands: `2.229`. */
export const formatStoryCount = (count: number) => {
  const digits = String(Math.abs(Math.trunc(count)));
  return `${count < 0 ? "-" : ""}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
};

const CTA_STYLES = ["button", "swipe_up", "both"] as const;

const link = (label: string, href: string | null, style: unknown = "button"): StoryLink | null => {
  if (!href) return null;
  // An unknown style shows as a button (the contract's "Unknown values").
  const known = CTA_STYLES.find((s) => s === style) ?? "button";
  return { style: known, label, href, external: !href.startsWith("/") };
};

/** The CTA's target; null for an unknown target without a fallback. */
const ctaTarget = (cta: IStoryCta | null | undefined): StoryLink | null => {
  const label = typeof cta?.label === "string" ? cta.label.trim() : "";
  const target = cta?.target;
  if (!label || !target || typeof target !== "object") return null;
  const fallback = safeHttpUrl(target.fallback_url);
  switch (target.type) {
    case "url":
      return link(label, safeHttpUrl(target.url));
    case "app_link":
      // A universal/app link (https) opens the app when it's installed, else its page;
      // a custom scheme only works with the app, so the browser gets the fallback.
      return link(label, safeHttpUrl(target.app_url) ?? fallback);
    case "story":
      return link(label, STORY_SLUG.test(target.story_slug ?? "") ? `/poveste/${target.story_slug}/` : null);
    case "in_app": {
      const slug = target.slug ?? "";
      if (target.route === "station" && STORY_SLUG.test(slug)) return link(label, `/${slug}/`);
      if (target.route === "announcement" && STORY_SLUG.test(slug)) return link(label, `/#anunt/${slug}`);
      return link(label, fallback);
    }
    default:
      return link(label, fallback);
  }
};

/** `#RRGGBB` or `#AARRGGBB` (the app's reading) as a CSS colour, or undefined. */
export const cssColor = (raw: unknown): string | undefined => {
  if (typeof raw !== "string") return undefined;
  const hex = raw.replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(hex)) return `#${hex.toLowerCase()}`;
  if (/^[0-9a-f]{8}$/i.test(hex)) {
    const [a, r, g, b] = [0, 2, 4, 6].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${+(a / 255).toFixed(3)})`;
  }
  return undefined;
};

/** Where a CTA goes on the website, and how it shows; null hides it. */
export const ctaLink = (cta: IStoryCta | null | undefined): StoryLink | null => {
  const target = ctaTarget(cta);
  const found = target && link(target.label, target.href, cta?.style);
  if (!found) return null;
  const color = cssColor(cta?.color);
  const textColor = cssColor(cta?.text_color);
  return { ...found, ...(color && { color }), ...(textColor && { textColor }) };
};

const youtubeMedia = (slide: IStorySlide): StoryMedia | null => {
  const url = safeHttpUrl(slide.youtube_url);
  let videoId = slide.youtube?.video_id ?? "";
  if (!YOUTUBE_ID.test(videoId) && url) {
    const parsed = new URL(url);
    videoId = parsed.searchParams.get("v")
      ?? parsed.pathname.match(/^\/(?:shorts\/|embed\/|live\/)?([A-Za-z0-9_-]{11})/)?.[1]
      ?? "";
  }
  if (!YOUTUBE_ID.test(videoId)) return null;
  return {
    kind: "youtube",
    videoId,
    url: url ?? `https://www.youtube.com/watch?v=${videoId}`,
    thumbnail: safeHttpUrl(slide.poster_url) ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    title: slide.youtube?.title || undefined,
  };
};

const instagramMedia = (slide: IStorySlide): StoryMedia | null => {
  const ig = slide.instagram;
  const url = safeHttpUrl(ig?.url);
  if (!ig || !url) return null;
  // Best first: Instagram's direct media, else its thumbnail with the caption, else the embed page.
  const direct = safeHttpUrl(ig.media_url);
  if (direct && ig.media_type === "image") return { kind: "image", src: direct };
  if (direct && ig.media_type === "video") return { kind: "video", src: direct, poster: safeHttpUrl(ig.thumbnail_url) ?? undefined };
  const embed = safeHttpUrl(ig.embed_url) ?? `${url.endsWith("/") ? url : `${url}/`}embed/`;
  return {
    kind: "instagram",
    url,
    embedUrl: embed,
    thumbnail: safeHttpUrl(ig.thumbnail_url) ?? undefined,
    author: ig.author_name || undefined,
    caption: ig.caption || undefined,
  };
};

const slideMedia = (slide: IStorySlide): StoryMedia | null => {
  switch (slide.type) {
    case "image": {
      const src = safeHttpUrl(slide.media_url);
      return src ? { kind: "image", src } : null;
    }
    case "video": {
      const src = safeHttpUrl(slide.media_url);
      return src ? { kind: "video", src, poster: safeHttpUrl(slide.poster_url) ?? undefined } : null;
    }
    case "youtube":
      return youtubeMedia(slide);
    case "instagram":
      return instagramMedia(slide);
    default:
      return null;
  }
};

/** The page's view of an API story, or null when there is nothing to show. */
export const toStoryView = (data: unknown): StoryView | null => {
  const story = data as IStory | null;
  if (!story || typeof story !== "object" || !STORY_SLUG.test(story.slug ?? "") || !Array.isArray(story.slides)) return null;
  const slides = story.slides.flatMap((slide): StorySlideView[] => {
    const media = slide && typeof slide === "object" ? slideMedia(slide) : null;
    return media
      ? [{
          id: Number(slide.id) || 0,
          media,
          landscape: slide.orientation === "landscape",
          duration: slideSeconds(slide.duration_seconds),
          hasSound: media.kind === "video" && slide.has_sound !== false,
          cta: ctaLink(slide.cta),
          caption: typeof slide.caption === "string" && slide.caption.trim() ? slide.caption.trim() : null,
        }]
      : [];
  });
  if (!slides.length) return null;
  return {
    slug: story.slug,
    title: (typeof story.title === "string" && story.title.trim()) || "Poveste",
    // The backend already falls back to the first slide's picture or poster.
    cover: safeHttpUrl(story.cover_url),
    shareUrl: storyUrl(story.slug),
    updatedAt: typeof story.updated_at === "string" ? story.updated_at : "",
    likeCount: Math.max(0, Math.floor(Number(story.like_count) || 0)),
    author:
      typeof story.author?.name === "string" && story.author.name.trim()
        ? { name: story.author.name.trim(), avatar: safeHttpUrl(story.author.avatar_url) }
        : null,
    messages: {
      enabled: story.messages?.enabled === true,
      placeholder: (typeof story.messages?.placeholder === "string" && story.messages.placeholder.trim()) || DEFAULT_MESSAGE_PLACEHOLDER,
    },
    slides,
  };
};

/** In its time window: starts_at <= now < ends_at (null: no limit on that side). */
export const isStoryLive = (story: Pick<IStory, "starts_at" | "ends_at">, now = Date.now()): boolean => {
  const starts = story.starts_at ? Date.parse(story.starts_at) : NaN;
  const ends = story.ends_at ? Date.parse(story.ends_at) : NaN;
  return !(starts > now) && !(ends <= now);
};

export const storyUrl = (slug: string) => `${SITE_URL}/poveste/${slug}/`;

/**
 * "Open in the app". Android: an intent for this very page in our package (Chrome doesn't hand a
 * same-site link to the app), falling back to the Play Store. iOS: the app's custom scheme;
 * the page sends the visitor to the App Store when the app didn't open.
 */
export const appLinks = (slug: string) => {
  const source = `story-${slug}`;
  const android = getAndroidStoreLink(source);
  return {
    android: `intent://www.radiocrestin.ro/poveste/${slug}/#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(android)};end`,
    ios: `radiocrestin://poveste/${slug}`,
    androidStore: android,
    iosStore: getIOSStoreLink(source),
  };
};

export const STORY_SHARE_TEXT = "Ascultă radiouri creștine și vezi poveștile în aplicația Radio Creștin.";

/** Open Graph / Twitter meta for a story's page. */
export const seoStory = (story: StoryView, defaultImage: string) => ({
  title: `${story.title} | Radio Creștin`,
  description: `${story.title}: o poveste de la Radio Creștin. Vezi-o aici sau în aplicația Radio Creștin.`,
  imageUrl: story.cover ?? defaultImage,
  fullURL: story.shareUrl,
  twitterCard: story.cover ? ("summary_large_image" as const) : ("summary" as const),
  // Stories expire: share previews read the meta, search engines needn't list them.
  noindex: true,
});

// ---- The stories bar (round pictures above the announcements, like the app's) ----

/** What a bubble needs; the slides load when it's tapped. */
export interface StoryBubble {
  slug: string;
  title: string;
  cover: string | null;
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string;
}

/** App-only stories (platforms set, none of them web) don't show on the website's bar. */
export const canShowStoryOnWeb = (story: { filters?: { platforms?: string[] | null } | null }) => {
  const platforms = story.filters?.platforms;
  return !platforms?.length || platforms.some((p) => typeof p === "string" && p.startsWith("web"));
};

export const toStoryBubble = (data: unknown): StoryBubble | null => {
  const story = data as IStory | null;
  if (!story || typeof story !== "object" || !STORY_SLUG.test(story.slug ?? "")) return null;
  if (!Array.isArray(story.slides) || !story.slides.length) return null;
  return {
    slug: story.slug,
    title: (typeof story.title === "string" && story.title.trim()) || "Poveste",
    cover: safeHttpUrl(story.cover_url),
    startsAt: story.starts_at ?? null,
    endsAt: story.ends_at ?? null,
    updatedAt: typeof story.updated_at === "string" ? story.updated_at : "",
  };
};

/** The bubbles of a stories list (GET /stories/), in the API's order. */
export const toStoryBubbles = (data: unknown): StoryBubble[] => {
  const stories = (data as { stories?: unknown[] } | null)?.stories;
  if (!Array.isArray(stories)) return [];
  return stories.flatMap((s) => (s && canShowStoryOnWeb(s as IStory) ? toStoryBubble(s) ?? [] : []));
};

/** slug -> updated_at of the version this device opened. */
export type SeenStories = Record<string, string>;

export const isBubbleSeen = (bubble: StoryBubble, seen: SeenStories) =>
  bubble.slug in seen && seen[bubble.slug] >= bubble.updatedAt;

/** As in the app: live ones only, new (coloured ring) first, each group in the API's order. */
export const orderBubbles = (bubbles: StoryBubble[], seen: SeenStories, now = Date.now()) => {
  const live = bubbles.filter((b) => isStoryLive({ starts_at: b.startsAt, ends_at: b.endsAt }, now));
  return [...live.filter((b) => !isBubbleSeen(b, seen)), ...live.filter((b) => isBubbleSeen(b, seen))];
};
