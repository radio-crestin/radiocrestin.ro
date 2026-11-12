// Shapes of GET /announcements/ (see the shared announcements SPEC).

export type RotationMode = "fixed" | "rotate" | "random";

export type ActionType =
  | "external"
  | "in_app_browser"
  | "android_intent"
  | "page"
  | "station"
  | "form"
  | "none";

export type ButtonStyle = "filled" | "outline" | "text" | "hidden";

export type Placement = "home" | "station";

/** What was tapped for a `clicked` event: the whole card or its button. */
export type ClickTarget = "card" | "button";

export type AnnouncementEventType =
  | "impression"
  | "clicked"
  | "dismissed"
  | "page_viewed"
  | "push_opened"
  | "video_play";

// Absent values are omitted by the API (never null), so every field but `type` is optional.
export interface IAnnouncementAction {
  type: ActionType;
  url?: string | null;
  web_target?: "new_tab" | "same_tab" | null;
  android_intent_uri?: string | null;
  fallback_url?: string | null;
  station_slug?: string | null;
  /** For `form`: the form to open in the form dialog. */
  form_slug?: string | null;
}

export interface IAnnouncementButton {
  /** website: the icon's SVG markup, added at build time */
  icon_svg?: string;
  label: string;
  style: ButtonStyle;
  /** Absent when not set by the admin: the client's theme colour applies. */
  color?: string;
  text_color?: string;
  icon: string;
  action: IAnnouncementAction;
}

export interface IAnnouncementPage {
  title: string;
  cover_image_url?: string | null;
  /** Sanitized server-side; only in GET /announcements/<slug>/. */
  html?: string;
}

export interface IAnnouncementCategory {
  slug: string;
  name: string;
  /** Absent when not set by the admin: the client's theme colour applies. */
  color?: string;
  text_color?: string;
}

/** Targeting the client evaluates (the list itself is the same for everyone and CDN-cached). */
export interface IAnnouncementFilters {
  platforms?: string[];
  countries_include?: string[];
  countries_exclude?: string[];
  locales?: string[];
}

// Optional blocks may be absent instead of null: the backend keeps the payload small.
export interface IAnnouncement {
  slug: string;
  /** The admin's drag-and-drop order (ascending); the API already sends items in this order. */
  position?: number;
  placement?: Placement;
  station_slugs?: string[];
  category?: IAnnouncementCategory;
  icon?: { name?: string | null; url?: string | null; /** website: added at build time */ svg?: string } | null;
  title: string;
  /** Sanitized server-side (strong, em, a, br). */
  body_html?: string;
  /** The app renders this; the website uses body_html. */
  body_markdown?: string;
  button?: IAnnouncementButton | null;
  page?: IAnnouncementPage | null;
  dismissible?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  hide_after_seconds?: number | null;
  max_impressions?: number | null;
  filters?: IAnnouncementFilters | null;
}

export interface IAnnouncementSettings {
  rotation_mode: RotationMode;
  max_per_load?: number;
  /** Seconds between automatic moves to the next announcement; 0 or absent = off. */
  autoplay_seconds?: number;
}

export interface IAnnouncementsResponse {
  settings: IAnnouncementSettings;
  announcements: IAnnouncement[];
}

/** The list fetched at build time and rendered into the HTML. */
export interface IAnnouncementsSnapshot extends IAnnouncementsResponse {
  /** When the build fetched it (ms); a newer stored feed can only remove items from it. */
  built_at: number;
}

export interface IAnnouncementEvent {
  slug: string;
  type: AnnouncementEventType;
  position: number;
  target: ClickTarget | null;
  placement: Placement;
  station_slug: string | null;
  /** For video_play (an embed opened on YouTube): "youtube" and the embed kind. */
  provider?: string;
  kind?: string;
  at: string;
}
