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
  /** Times it already came back (show_again_times). */
  returns: Record<string, number>;
  /** Shown at least once (its show_after wait is over); only for announcements with a wait. */
  started: Record<string, boolean>;
  /**
   * count_on events while it waits: before its first showing (show_after), or hidden by the
   * current round's rules (show_again_after). Back to 0 when it shows.
   */
  waited: Record<string, number>;
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

type RoundCounts = Pick<
  AnnouncementsLocalState,
  "dismissed" | "impressions" | "clicks" | "afterClicks" | "started" | "returns" | "waited"
>;

/** What a step changes: every per-slug map but `dismissed`. */
export type WaitCounts = Omit<RoundCounts, "dismissed">;

type HideReason = "dismissed" | "show_after" | "max_impressions" | "clicks" | "impressions_after_click" | null;

/**
 * Why `a` is hidden on this device, or null when it shows: the spec's hide_reason, the first
 * rule that matches. annEligibility (the pre-paint) decides the same with its compact data.
 */
export const hideReason = (a: IAnnouncement, s: RoundCounts): HideReason => {
  if (a.dismissible !== false && s.dismissed[a.slug]) return "dismissed";
  if (!s.started[a.slug] && a.show_after && (s.waited[a.slug] || 0) < a.show_after) return "show_after";
  if (a.max_impressions != null && (s.impressions[a.slug] || 0) >= a.max_impressions) return "max_impressions";
  if (a.hide_after_clicks && (s.clicks[a.slug] || 0) >= a.hide_after_clicks) {
    if (!a.impressions_after_click) return "clicks";
    if ((s.afterClicks[a.slug] || 0) >= a.impressions_after_click) return "impressions_after_click";
  }
  return null;
};

const canComeBack = (a: IAnnouncement) => !!a.show_again_times && !!a.show_again_after;
const hiddenForTheRound = (reason: HideReason) =>
  reason === "max_impressions" || reason === "clicks" || reason === "impressions_after_click";

/** Whether `a` has a wait at all (show_after, or show it again); else nothing is counted for it. */
const hasWaits = (a: IAnnouncement) => !!a.show_after || canComeBack(a);

/** Waiting for count_on events: before its first showing, or hidden by a round's rules with show again set. */
const isWaiting = (a: IAnnouncement, s: RoundCounts) => {
  const reason = hideReason(a, s);
  return reason === "show_after" || (hiddenForTheRound(reason) && canComeBack(a));
};

/** Whether, at this visit, it comes back: a round's rules hide it, but it waited long enough. */
export const comesBack = (a: IAnnouncement, s: RoundCounts): boolean =>
  hiddenForTheRound(hideReason(a, s)) &&
  canComeBack(a) &&
  (s.returns[a.slug] || 0) < a.show_again_times! &&
  (s.waited[a.slug] || 0) >= a.show_again_after!;

const without = <T,>(map: Record<string, T>, slug: string) => {
  if (!(slug in map)) return map;
  const { [slug]: _, ...rest } = map;
  return rest;
};

const pick = (s: RoundCounts): WaitCounts => ({
  impressions: s.impressions,
  clicks: s.clicks,
  afterClicks: s.afterClicks,
  started: s.started,
  returns: s.returns,
  waited: s.waited,
});

/** A device event the waits can count on: a visit, another announcement seen, or a playback. */
export type WaitEvent = { kind: "visits" } | { kind: "impressions"; of: string } | { kind: "playbacks"; station: string };

/**
 * The spec's on_event for every announcement: each one that waits and counts on this kind of
 * event gets one more `waited` (playbacks: only of its count_station_slugs, when set; another
 * announcement's impression: never its own). Null when nothing changes.
 */
export const withEvent = (state: RoundCounts, announcements: IAnnouncement[], event: WaitEvent): WaitCounts | null => {
  let waited: Record<string, number> | null = null;
  for (const a of announcements) {
    if (!hasWaits(a) || (a.count_on || "visits") !== event.kind) continue;
    if (event.kind === "impressions" && event.of === a.slug) continue;
    const stations = a.count_station_slugs;
    if (event.kind === "playbacks" && stations?.length && !stations.includes(event.station)) continue;
    if (!isWaiting(a, state)) continue;
    waited ??= { ...state.waited };
    waited[a.slug] = (waited[a.slug] || 0) + 1;
  }
  return waited && { ...pick(state), waited };
};

/**
 * A visit (a page load where the announcements load), the spec's on_visit. `shown` is what this
 * visit shows (annEligibility, which already lets a returning one through): one a round's rules
 * hide but that shows has come back, so a new round starts (its counts back to 0, returns + 1);
 * one that shows for the first time has started (its show_after wait is over); one that doesn't
 * show counts the visit when it waits on visits. Closed: never back.
 */
export const withVisit = (state: RoundCounts, announcements: IAnnouncement[], shown: string[]): WaitCounts | null => {
  let next: WaitCounts | null = null;
  const hidden: IAnnouncement[] = [];
  for (const a of announcements) {
    if (!hasWaits(a)) continue;
    if (!shown.includes(a.slug)) {
      hidden.push(a);
      continue;
    }
    const s: RoundCounts = next ? { ...state, ...next } : state;
    if (comesBack(a, s)) {
      next = {
        impressions: without(s.impressions, a.slug),
        clicks: without(s.clicks, a.slug),
        afterClicks: without(s.afterClicks, a.slug),
        started: { ...s.started, [a.slug]: true },
        returns: { ...s.returns, [a.slug]: (s.returns[a.slug] || 0) + 1 },
        waited: without(s.waited, a.slug),
      };
    } else if (!s.started[a.slug] && hideReason(a, s) === null) {
      next = { ...pick(s), started: { ...s.started, [a.slug]: true }, waited: without(s.waited, a.slug) };
    }
  }
  const s: RoundCounts = next ? { ...state, ...next } : state;
  return withEvent(s, hidden, { kind: "visits" }) ?? next;
};

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
  /** The Web Share API, else the link copied; url absent: the website, text absent: ours. */
  | { kind: "share"; url: string | null; text: string | null }
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
    case "share": {
      // an unsafe link (javascript:…) shares the website instead
      const url = safeHref(action.url);
      return { kind: "share", url: url && new URL(url, SITE_ORIGIN).href, text: action.share_text || null };
    }
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
