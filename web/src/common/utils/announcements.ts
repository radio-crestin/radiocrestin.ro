// Small pure helpers for announcements: placement, the page hash, and what a
// button does on the web. Which announcements show is decided in announcementsPrepaint.ts.
import { SAFE_SLUG } from "@/utils/announcementsPrepaint";
import type {
  AnnouncementEventType,
  ClickTarget,
  HideClickTarget,
  IAnnouncement,
  IAnnouncementAction,
  IAnnouncementsSnapshot,
  Placement,
} from "@/models/Announcement";

export interface AnnouncementsLocalState {
  dismissed: Record<string, string>;
  impressions: Record<string, number>;
  /** Clicks that count toward hide_after_clicks (only for announcements with that rule). */
  clicks: Record<string, number>;
  /** Impressions since the click that reached hide_after_clicks, for impressions_after_click. */
  afterClicks: Record<string, number>;
  rotationCursor: number;
  seen: Record<string, string>;
  /** From Cloudflare via the events API: undefined = never asked, null = unknown. */
  country?: string | null;
}

// Hide rules after clicks (backend/docs/announcement-hide-rules.md). Whether a slug shows is
// decided in announcementsPrepaint.ts (annEligibility); these keep the counts it reads.

/**
 * Whether an event counts toward hide_after_clicks: "main" counts the button and the card (and a
 * click with no target), "any" every click, also links in the description.
 */
export const countsAsHideClick = (
  hideClickTarget: HideClickTarget | null | undefined,
  type: AnnouncementEventType | "secondary_clicked",
  target?: ClickTarget | null,
): boolean => {
  if (type === "secondary_clicked") return hideClickTarget === "any";
  return type === "clicked" && (hideClickTarget === "any" || target !== "link");
};

type ClickCounts = Pick<AnnouncementsLocalState, "clicks" | "afterClicks">;

/**
 * The counts after a click on `a`; unchanged when it doesn't count. The click that reaches
 * hide_after_clicks starts the reminder count (impressions_after_click) at 0: the impression on
 * screen during it isn't one, and later clicks don't restart it.
 */
export const withClick = (
  state: ClickCounts,
  a: Pick<IAnnouncement, "slug" | "hide_after_clicks" | "impressions_after_click" | "hide_click_target">,
  target: ClickTarget | null | undefined,
): ClickCounts => {
  if (!a.hide_after_clicks || !countsAsHideClick(a.hide_click_target, "clicked", target)) return state;
  const clicks = (state.clicks[a.slug] || 0) + 1;
  const startReminders =
    !!a.impressions_after_click && clicks >= a.hide_after_clicks && state.afterClicks[a.slug] === undefined;
  return {
    clicks: { ...state.clicks, [a.slug]: clicks },
    afterClicks: startReminders ? { ...state.afterClicks, [a.slug]: 0 } : state.afterClicks,
  };
};

/** Whether `a` must leave the current view at this click: hide_after_clicks reached, no reminders. */
export const hiddenAtClick = (a: IAnnouncement, clicks: Record<string, number>): boolean =>
  !!a.hide_after_clicks && !a.impressions_after_click && (clicks[a.slug] || 0) >= a.hide_after_clicks;

export const placementOf = (a: IAnnouncement): Placement => a.placement ?? "home";

export const isForStation = (a: IAnnouncement, stationSlug: string): boolean =>
  placementOf(a) === "station" && (a.station_slugs ?? []).includes(stationSlug);

/**
 * A station page's snapshot: the station's own announcements move into the card, ahead of the
 * home ones, and the order is fixed so rotation never starts the card on another announcement.
 */
export const stationFirst = (snapshot: IAnnouncementsSnapshot, stationSlug?: string): IAnnouncementsSnapshot => {
  if (!stationSlug) return snapshot;
  const own = snapshot.announcements.filter((a) => isForStation(a, stationSlug));
  const result = { ...snapshot, station_slug: stationSlug };
  if (!own.length) return result;
  return {
    ...result,
    settings: { ...snapshot.settings, rotation_mode: "fixed" },
    announcements: [
      ...own.map((a) => ({ ...a, placement: "home" as const, station_slugs: [] })),
      ...snapshot.announcements.filter((a) => !own.includes(a)),
    ],
  };
};


// `#anunt/<slug>` opens an announcement's page dialog.
/** Whether body markup shows any text (the backend may send "", null or empty tags). */
export const hasBodyText = (html: string | null | undefined): html is string =>
  !!html && html.replace(/<[^>]*>|&nbsp;|&#160;|\s/g, "") !== "";

export const ANNOUNCEMENT_HASH_PREFIX = "#anunt/";

export const slugFromHash = (hash: string): string | null => {
  if (!hash.startsWith(ANNOUNCEMENT_HASH_PREFIX)) return null;
  try {
    return decodeURIComponent(hash.slice(ANNOUNCEMENT_HASH_PREFIX.length)).trim() || null;
  } catch {
    return null;
  }
};

export type WebAction =
  | { kind: "link"; href: string; newTab: boolean }
  | { kind: "page" }
  | { kind: "form"; slug: string }
  | null;

const SITE_ORIGIN = "https://www.radiocrestin.ro";
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * The href if it is a web, mail or phone link (or a path on this site), else null.
 * Blocks javascript:, data: and other schemes that would run code when followed.
 */
export const safeHref = (href: string | null | undefined): string | null => {
  if (!href) return null;
  const origin = typeof location !== "undefined" ? location.origin : SITE_ORIGIN;
  try {
    return SAFE_PROTOCOLS.has(new URL(href, origin).protocol) ? href : null;
  } catch {
    return null;
  }
};

/** What a button does on the website (the SPEC's website column). */
export const resolveWebAction = (action: IAnnouncementAction | null | undefined): WebAction => {
  if (!action) return null;
  const link = (href: string | null | undefined, newTab = true): WebAction => {
    const safe = safeHref(href);
    return safe ? { kind: "link", href: safe, newTab } : null;
  };

  switch (action.type) {
    case "external":
      return link(action.url, action.web_target !== "same_tab");
    case "in_app_browser":
      return link(action.url);
    case "android_intent":
      return link(action.fallback_url);
    case "station":
      return link(action.station_slug && `/${encodeURIComponent(action.station_slug)}`, false);
    case "page":
      return { kind: "page" };
    case "form":
      return action.form_slug && SAFE_SLUG.test(action.form_slug) ? { kind: "form", slug: action.form_slug } : null;
    default:
      return null;
  }
};

/**
 * The visit's sequence: the server's order (never re-sorted) rotated to begin at `start`
 * (start…n-1, then 0…start-1). Paging stops at both ends of it, so every item stays reachable.
 */
export const rotateFrom = <T,>(items: T[], start: number): T[] =>
  start > 0 && start < items.length ? [...items.slice(start), ...items.slice(0, start)] : items;

const AUTOPLAY_MIN_S = 3;
const AUTOPLAY_MAX_S = 60;

/** settings.autoplay_seconds as a usable interval: 0 (off) or 3–60 seconds. */
export const autoplaySeconds = (settings: { autoplay_seconds?: unknown } | null | undefined): number => {
  const s = Number(settings?.autoplay_seconds);
  if (!Number.isFinite(s) || s <= 0) return 0;
  return Math.min(AUTOPLAY_MAX_S, Math.max(AUTOPLAY_MIN_S, s));
};

/** Paging stops at the ends (no wrap-around): the index `step` away, or null past an end. */
export const pageTarget = (index: number, count: number, step: number): number | null => {
  const target = index + step;
  return target >= 0 && target < count ? target : null;
};
