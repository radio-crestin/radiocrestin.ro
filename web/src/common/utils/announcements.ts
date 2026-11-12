// Small pure helpers for announcements: placement, the page hash, and what a
// button does on the web. Which announcements show is decided in announcementsPrepaint.ts.
import { SAFE_SLUG } from "@/utils/announcementsPrepaint";
import type {
  IAnnouncement,
  IAnnouncementAction,
  Placement,
} from "@/models/Announcement";

export interface AnnouncementsLocalState {
  dismissed: Record<string, string>;
  impressions: Record<string, number>;
  rotationCursor: number;
  seen: Record<string, string>;
  /** From Cloudflare via the events API: undefined = never asked, null = unknown. */
  country?: string | null;
}


export const placementOf = (a: IAnnouncement): Placement => a.placement ?? "home";

export const isForStation = (a: IAnnouncement, stationSlug: string): boolean =>
  placementOf(a) === "station" && (a.station_slugs ?? []).includes(stationSlug);


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

/** Paging stops at the ends (no wrap-around): the index `step` away, or null past an end. */
export const pageTarget = (index: number, count: number, step: number): number | null => {
  const target = index + step;
  return target >= 0 && target < count ? target : null;
};
