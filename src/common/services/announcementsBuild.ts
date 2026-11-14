// Build-time only (imported by the Astro pages): the snapshot the pages render, carrying the
// SVG markup of just the icons it uses, so the client bundle ships no icon set.
import type { IAnnouncement, IAnnouncementsSnapshot } from "@/models/Announcement";
import { getAnnouncementsSnapshot } from "@/services/announcements";
import { buttonIconSvg, ICON_SVGS } from "@/services/announcementIconSvgs";
import { prepareAnnouncementsMarkup } from "@/components/Announcements";
import { contentStore } from "@/components/Announcements/content";
import { stationFirst } from "@/utils/announcements";

const withIconSvgs = (a: IAnnouncement): IAnnouncement => ({
  ...a,
  icon: a.icon?.url ? a.icon : { ...a.icon, svg: ICON_SVGS[a.icon?.name || "info"] ?? ICON_SVGS.info },
  ...(a.button && { button: { ...a.button, icon_svg: buttonIconSvg(a.button.icon || "auto", a.button.action.type) } }),
});

/** App-only announcements (platforms set, none of them web) can never show here. */
const canShowOnWeb = (a: IAnnouncement) => {
  const platforms = a.filters?.platforms;
  return !platforms?.length || platforms.some((p) => p.startsWith("web_"));
};

/** Drops empty lists and nulls, recursively: they cost bytes in every page's props. */
const compact = <T,>(value: T): T => {
  if (Array.isArray(value)) return value.map(compact) as T;
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value)
    .filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => [k, compact(v)]);
  return Object.fromEntries(entries) as T;
};

// The island props are serialized into every page: keep only what rendering needs.
const forProps = ({ position, page, body_markdown, ...a }: IAnnouncement): IAnnouncement => compact(a);

let snapshot: Promise<IAnnouncementsSnapshot> | null = null;
const getShowableSnapshot = (): Promise<IAnnouncementsSnapshot> => {
  if (import.meta.env.MODE === "development") snapshot = null; // fresh on every dev render, like the service
  snapshot ??= getAnnouncementsSnapshot().then((s) => ({
    ...s,
    announcements: s.announcements.filter(canShowOnWeb).map((a) => forProps(withIconSvgs(a))),
  }));
  return snapshot;
};

/**
 * The markup a home slide renders (body, icon, button icon) leaves the props: the server
 * renders it from contentStore and the browser reads it back from the HTML (content.ts).
 */
const withoutRenderedMarkup = (a: IAnnouncement): IAnnouncement => {
  if ((a.placement ?? "home") !== "home") return a;
  const { body_html, ...rest } = a;
  return compact({
    ...rest,
    icon: a.icon && { ...a.icon, svg: undefined },
    button: a.button && { ...a.button, icon_svg: undefined },
  });
};

/**
 * The snapshot one page renders: the home announcements, led by the station's own on a station
 * page (station links are full page loads, so no other station's are ever needed there).
 */
export const getBuildSnapshot = async (stationSlug?: string): Promise<IAnnouncementsSnapshot> => {
  const s = await getShowableSnapshot();
  for (const a of s.announcements) contentStore[a.slug] = a;
  const forThisPage = (a: IAnnouncement) =>
    (a.placement ?? "home") === "home" || (!!stationSlug && (a.station_slugs ?? []).includes(stationSlug));
  const ordered = stationFirst({ ...s, announcements: s.announcements.filter(forThisPage) }, stationSlug);
  const page = { ...ordered, announcements: ordered.announcements.map(withoutRenderedMarkup) };
  await prepareAnnouncementsMarkup(page, stationSlug);
  return page;
};
