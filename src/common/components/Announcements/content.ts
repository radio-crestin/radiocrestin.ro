// The markup inside a home slide (body, icon, button icon) is not in the island props: it would
// travel twice in every page. The server takes it from the build snapshot; the browser reads it
// back from the server-rendered card before hydrating it, so both render the same thing.
import type { IAnnouncement } from "@/models/Announcement";

/** Server only: the full announcements of the build, by slug (filled by getBuildSnapshot). */
export const contentStore: Record<string, IAnnouncement> = ((globalThis as { __announcementsContent?: Record<string, IAnnouncement> })
  .__announcementsContent ??= {});

const html = (el: Element | null | undefined) => (el ? el.innerHTML : undefined);

/** The announcement with its rendered markup filled back in. */
export const withRenderedMarkup = (a: IAnnouncement): IAnnouncement => {
  if (typeof document === "undefined") {
    const full = contentStore[a.slug];
    return full ? { ...a, body_html: full.body_html, icon: full.icon, button: full.button } : a;
  }
  const slide = document.querySelector(`[data-ann-r] section[data-ann="${a.slug}"]`);
  if (!slide || a.body_html !== undefined) return a;
  const iconTile = slide.querySelector(".ann-icon");
  return {
    ...a,
    body_html: html(slide.querySelector(".ann-body")),
    icon: iconTile?.querySelector("img") ? a.icon : { ...a.icon, svg: html(iconTile) },
    button: a.button && { ...a.button, icon_svg: html(slide.querySelector(".ann-ctaIcon")) },
  };
};
