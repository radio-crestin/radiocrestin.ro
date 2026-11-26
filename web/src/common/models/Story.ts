// The stories API (backend/docs/stories-api.md). Only what the website's share page reads;
// the API sends more, and clients ignore keys they don't know.

export type StorySlideType = "image" | "video" | "youtube" | "instagram";

export interface IStoryCtaTarget {
  type: "url" | "app_link" | "in_app" | "story" | string;
  url?: string;
  open_in?: "browser" | "in_app_browser";
  app_url?: string;
  fallback_url?: string;
  app?: string;
  route?: string;
  slug?: string;
  story_slug?: string;
}

export interface IStoryCta {
  style: "swipe_up" | "button" | "both" | string;
  label: string;
  /** The button's colour and its label's (`#RRGGBB`, or `#AARRGGBB` as the app reads it). */
  color?: string | null;
  text_color?: string | null;
  target: IStoryCtaTarget;
}

export interface IStoryInstagram {
  url: string;
  kind: "post" | "reel";
  thumbnail_url?: string | null;
  author_name?: string | null;
  caption?: string | null;
  media_url?: string | null;
  media_type?: "image" | "video" | null;
  embed_url?: string | null;
}

export interface IStorySlide {
  id: number;
  type: StorySlideType | string;
  media_url: string | null;
  poster_url: string | null;
  duration_seconds?: number;
  orientation?: "portrait" | "landscape";
  has_sound?: boolean;
  youtube_url: string | null;
  youtube?: { video_id?: string; title?: string; thumbnail?: string; kind?: string } | null;
  instagram: IStoryInstagram | null;
  cta: IStoryCta | null;
  /** Shown under who the story is from. */
  caption?: string | null;
  width?: number;
  height?: number;
}

export interface IStory {
  id?: number;
  slug: string;
  title: string;
  cover_url: string | null;
  share_url: string;
  starts_at: string | null;
  ends_at: string | null;
  updated_at?: string;
  like_count?: number;
  /** Same keys as the announcements' filters; the website's bar reads `platforms`. */
  filters?: { platforms?: string[] | null } | null;
  /** Who the story is from, under the call to action (the app's default: the title). */
  author?: { name?: string | null; avatar_url?: string | null } | null;
  /** Public comments ("Comentarii"), off unless the admin turns them on; the website shows the count. */
  comments?: { enabled?: boolean; placeholder?: string | null; count?: number } | null;
  slides: IStorySlide[];
}
