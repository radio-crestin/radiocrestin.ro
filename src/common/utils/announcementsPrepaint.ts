// Which announcements may show now. Runs twice from the same code: inline in BaseLayout's
// <head> before first paint (it hides the rest with a <style>), and in the island, which then
// takes over with identical results, so the layout never shifts.
// annEligibility and annPrepaintBoot are stringified into the page: keep them self-contained
// (no imports, no outer variables) and small; they are minified to ES2019.
// Markup they style: data-ann="<slug>" on slides and bell markers; data-ann-r on the
// card's wrapper (data-ann-pp too, until the card's code takes over); data-ann-m on what only makes sense with 2+ slides; data-ann-b="<station>"
// on station bells; data-ann-a on the slide the server shows; data-ann-c on the "i din N" text.
import type { IAnnouncementsSnapshot, RotationMode } from "@/models/Announcement";

export interface PrepaintItem {
  /** slug */
  s: string;
  /** station slugs; present only for station announcements */
  st?: string[];
  /** starts_at / ends_at (ms) */
  a?: number;
  e?: number;
  /** max_impressions */
  m?: number;
  /** 1 when closing the old, hard-coded banner (LEGACY_DISMISSED_KEY) dismissed this one */
  l?: 1;
  /**
   * filters, only the non-empty ones: p = the web viewports allowed ("m", "d", both, or ""
   * for app-only), ci / ce = countries include / exclude, lo = normalised locales
   */
  f?: { p?: string; ci?: string[]; ce?: string[]; lo?: string[] };
}

export interface PrepaintData {
  /** built_at (ms) */
  b: number;
  /** rotation: 0 fixed, 1 rotate, 2 random */
  r: number;
  /** max_per_load: how many home announcements may show, counted after eligibility */
  x: number;
  i: PrepaintItem[];
}

export interface PrepaintLocal {
  dismissed?: Record<string, string>;
  impressions?: Record<string, number>;
  rotationCursor?: number;
  country?: string | null;
  /** the LEGACY_DISMISSED_KEY value; set means the old banner was closed */
  w?: unknown;
}

/** The last fresh list: when it was fetched (ms) and its slugs. */
export interface PrepaintFeed {
  t: number;
  s: string[];
}

export interface PrepaintView {
  /** every slug that may show (home and station) */
  v: string[];
  /** the home slugs that may show, in order */
  h: string[];
  /** the home slide to start on */
  k: number;
}

/** One view per viewport: m below 768px, d from 768px. */
export interface PrepaintResult {
  m: PrepaintView;
  d: PrepaintView;
}

/**
 * Slugs end up inside CSS selectors (and are compared by the inline script), so anything
 * but letters, digits, "-" and "_" is dropped. The inline functions repeat this check.
 */
export const SAFE_SLUG = /^[\w-]{1,100}$/;
export const MOBILE_QUERY = "(max-width: 767.9px)";

/** `lang` is navigator.language lower-cased (filter locales are normalised the same way). */
export function annEligibility(
  d: PrepaintData,
  local: PrepaintLocal,
  feed: PrepaintFeed | null,
  lang: string,
  now: number,
  /** Math.random(), for rotation_mode random */
  x: number,
): PrepaintResult {
  const view = (vp: string): PrepaintView => {
    let homeCount = 0;
    const v = d.i.filter((it) => {
      const s = it.s;
      const f = it.f || {};
      const c = local.country;
      if ((local.dismissed || {})[s] || (it.l && local.w)) return false;
      // comparisons with an absent field are false, so absent means "no limit"
      if (((local.impressions || {})[s] || 0) >= it.m! || it.a! > now || it.e! <= now) return false;
      if (feed && feed.t > d.b && !feed.s.includes(s)) return false;
      if (f.p != null && !f.p.includes(vp)) return false;
      if (f.lo && !f.lo.some((l) => l === lang || l === lang.split("-")[0])) return false;
      if ((f.ci || f.ce) && (!c || (f.ci && !f.ci.includes(c)) || (f.ce || []).includes(c))) return false;
      return !!it.st || ++homeCount <= d.x;
    });
    const h = v.filter((it) => !it.st).map((it) => it.s);
    const n = h.length;
    // with n = 0 the modulo is NaN, hence the `|| 0`
    const k = d.r == 1 ? (local.rotationCursor || 0) % n || 0 : d.r == 2 ? (x * n) | 0 : 0;
    return { v: v.map((it) => it.s), h, k };
  };
  return { m: view("m"), d: view("d") };
}

/**
 * The old, hard-coded WhatsApp banner stored its own "closed" flag; a visitor who closed it
 * has dismissed the announcement that replaced it.
 */
export const LEGACY_DISMISSED_KEY = "whatsapp-verse-dismissed";
export const LEGACY_SLUG = "whatsapp-versetul-zilei";

/** Reads local state, writes the hiding <style> and leaves the result on window.__ann. */
export function annPrepaintBoot(d: PrepaintData, elig: typeof annEligibility) {
  try {
    // Corrupt storage throws to the outer catch: nothing is hidden, and the island agrees.
    const read = (key: string) => JSON.parse(localStorage.getItem(key)!);
    // navigator.language is already a BCP 47 tag ("ro-RO"); filter locales are normalised to match
    const lang = navigator.language.toLowerCase();
    // Slugs go into CSS selectors: keep only plain ones (the build already did; this is the backstop).
    const ok = (x: string) => /^[\w-]{1,100}$/.test(x);
    d.i = d.i.filter((it) => ok(it.s) && (it.st || []).every(ok));
    const local: PrepaintLocal = (read("announcements-store") || {}).state || {};
    local.w = read("whatsapp-verse-dismissed"); // LEGACY_DISMISSED_KEY, inlined
    const r = elig(d, local, read("announcements-feed"), lang, Date.now(), Math.random());
    // Rules for the server markup only: the card drops data-ann-pp once its code has taken over.
    const pp = "[data-ann-pp] ";
    let css = "";
    (["m", "d"] as const).forEach((vp) => {
      const w = r[vp];
      const n = w.h.length;
      const first = w.h[w.k];
      const hide: string[] = [];
      const bells: Record<string, boolean> = {};
      d.i.forEach((it) => {
        const shown = w.v.includes(it.s);
        if (!shown) hide.push('[data-ann="' + it.s + '"]');
        (it.st || []).forEach((s) => (bells[s] = bells[s] || shown));
      });
      for (const s in bells) if (!bells[s]) hide.push('[data-ann-b="' + s + '"]');
      if (n < 2) hide.push("[data-ann-m]");
      // No slide: hide the card. Otherwise the server's first slide (data-ann-a) gives way to the
      // rotation's start slide.
      hide.push(n ? "[data-ann-a]" : "[data-ann-r]");
      css +=
        "@media(" + (vp > "d" ? "max-width:767.9" : "min-width:768") + "px){" +
        hide.join(",") + "{display:none!important}" +
        (n
          ? pp + '[data-ann="' + first + '"]{display:grid!important' +
            // fade "previous" on the first slide and "next" on the last (paging doesn't wrap)
            (w.k ? "" : ";--pf:.4") + (w.k < n - 1 ? "" : ";--nf:.4") + "}" +
            pp + '[data-ann-c]:before{content:"' + (w.k + 1) + " din " + n + '"}'
          : "") +
        "}";
    });
    // Only plain slugs and numbers reach the CSS, so it can't close the <style> early.
    document.write("<style>" + css + "</style>");
    (window as unknown as { __ann: PrepaintResult }).__ann = r;
  } catch (e) {
    // Without localStorage everything in the snapshot shows; the island agrees.
  }
}

const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) || undefined : undefined);

const ROTATION: Record<RotationMode, number> = { fixed: 0, rotate: 1, random: 2 };
const nonEmpty = (list: string[] | undefined) => (list && list.length ? list : undefined);

/** The compact form of the snapshot that the inline script needs (no titles or bodies). */
export const toPrepaintData = (snapshot: IAnnouncementsSnapshot): PrepaintData => ({
  b: snapshot.built_at,
  r: ROTATION[snapshot.settings.rotation_mode] ?? 0,
  x: snapshot.settings.max_per_load ?? 99,
  i: snapshot.announcements
    .filter((a) => SAFE_SLUG.test(a.slug))
    .map((a) => {
      const f = a.filters || {};
      const item: PrepaintItem = { s: a.slug };
      if (a.slug === LEGACY_SLUG) item.l = 1;
      if (a.placement === "station") item.st = (a.station_slugs || []).filter((s) => SAFE_SLUG.test(s));
      if (time(a.starts_at)) item.a = time(a.starts_at);
      if (time(a.ends_at)) item.e = time(a.ends_at);
      if (a.max_impressions != null) item.m = a.max_impressions;
      const platforms = nonEmpty(f.platforms);
      const filters = {
        p: platforms && (platforms.includes("web_mobile") ? "m" : "") + (platforms.includes("web_desktop") ? "d" : ""),
        ci: nonEmpty(f.countries_include),
        ce: nonEmpty(f.countries_exclude),
        lo: nonEmpty(f.locales)?.map((l) => l.toLowerCase().replace("_", "-")),
      };
      if (Object.values(filters).some((v) => v !== undefined)) item.f = filters;
      return item;
    }),
});
