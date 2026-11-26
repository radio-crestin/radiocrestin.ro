import type { IStation, IStationGroup } from "@/models/Station";

// Romanian numeral agreement: 1 persoană / 8 persoane / 66 de persoane
export const roPlural = (n: number, singular: string, plural: string) =>
  n === 1 ? `1 ${singular}` : n < 20 ? `${n} ${plural}` : `${n} de ${plural}`;

// One shared formatter for review dates: toLocaleDateString(locale, options)
// builds a fresh ICU formatter on every call (~0.1ms each with a timeZone) —
// Radio Gosen's 225 reviews cost ~25ms per render (60ms+ at 4× CPU) inside
// every station switch. Same locale and options, so the output is identical.
// timeZone pinned: the build runs on UTC, visitors don't — an unpinned format
// renders a different calendar day and breaks hydration (React #418) for
// late-evening reviews.
const REVIEW_DATE_FORMAT = new Intl.DateTimeFormat("ro-RO", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Europe/Bucharest",
});

export const formatReviewDate = (isoDate: string) =>
  REVIEW_DATE_FORMAT.format(new Date(isoDate));

/**
 * clean the Stations metadata because the pages are rendered statically, and the metadata will pe loaded on client side.
 * @param stations
 */
export function cleanStationsMetadata(stations: IStation[]) {
  return stations.map((station: IStation) => {
    // Use local optimized WebP thumbnail for static render
    station.thumbnail_url = `/station-thumbnails/${station.slug}.webp`;

    // Set song's thumbnail_url and name
    if (station.now_playing && station.now_playing.song) {
      station.now_playing.song.thumbnail_url = null;
      station.now_playing.song.name = "";
    }

    // Set artist's thumbnail_url and name
    if (
      station.now_playing &&
      station.now_playing.song &&
      station.now_playing.song.artist
    ) {
      station.now_playing.song.artist.thumbnail_url = null;
      station.now_playing.song.artist.name = "";
    }

    // Set total_listeners to 0
    station.total_listeners = 0;

    // Set is_up to true (real value will be fetched on client side)
    if (station.uptime) {
      station.uptime.is_up = true;
    }

    return station;
  });
}

/**
 * Island props are serialized into every page's HTML, 64 stations at a time.
 * Keeps only the fields the islands read before their first API refresh,
 * which replaces every station object with the full one. Dropped: posts,
 * e-mail, proxy/DVR URLs, uptime probe details, __typename tags and other
 * fields no client code reads.
 */
export function toIslandStations(stations: IStation[]): IStation[] {
  return stations.map((s) => {
    const song = s.now_playing?.song;
    return {
      id: s.id,
      slug: s.slug,
      order: s.order,
      title: s.title,
      website: s.website,
      facebook_page_id: s.facebook_page_id,
      stream_url: s.stream_url,
      hls_stream_url: s.hls_stream_url,
      ...(s.audio_gain_db ? { audio_gain_db: s.audio_gain_db } : {}),
      thumbnail_url: s.thumbnail_url,
      total_listeners: s.total_listeners,
      description: s.description,
      station_streams: s.station_streams?.map(({ type, stream_url, order }) => ({
        type,
        stream_url,
        order,
      })),
      uptime: s.uptime && { is_up: s.uptime.is_up },
      now_playing: s.now_playing && {
        id: s.now_playing.id,
        song: song && {
          id: song.id,
          name: song.name,
          thumbnail_url: song.thumbnail_url,
          artist: song.artist && {
            id: song.artist.id,
            name: song.artist.name,
            thumbnail_url: song.artist.thumbnail_url,
          },
        },
      },
      reviews_stats: s.reviews_stats && {
        number_of_reviews: s.reviews_stats.number_of_reviews,
        average_rating: s.reviews_stats.average_rating,
      },
      is_favorite: s.is_favorite,
    } as IStation;
  });
}

/**
 * Full API refreshes bring cdn.radiocrestin.ro thumbnail URLs that are pixel-
 * identical to the build-time /station-thumbnails/ files already painted by
 * SSR. Swapping the src re-downloads every logo from a cold origin and
 * re-anchors LCP to that late fetch — so keep the local file for stations the
 * build knew about. Stations added after the deploy (no local file) keep their
 * API URL. Song art (now_playing.song.thumbnail_url) is untouched.
 */
export function preserveLocalThumbnails(prev: IStation[], next: IStation[]): IStation[] {
  const localById = new Map<number, string>();
  for (const s of prev) {
    if (s.thumbnail_url?.startsWith("/station-thumbnails/")) {
      localById.set(s.id, s.thumbnail_url);
    }
  }
  if (localById.size === 0) return next;
  return next.map((s) => {
    const local = localById.get(s.id);
    return local ? { ...s, thumbnail_url: local } : s;
  });
}

// Stations belonging to an API station_group (e.g. "muzica", "predici",
// "copii"), in the group's curated order — used by the category pages.
export function stationsInGroup(
  stations: IStation[],
  groups: IStationGroup[],
  groupSlug: string,
): IStation[] {
  const group = (groups || []).find((g) => g.slug === groupSlug);
  if (!group) return [];
  return (group.station_to_station_groups || [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((m) => stations.find((s) => s.id === m.station_id))
    .filter((s): s is IStation => Boolean(s));
}

export const DEFAULT_RADIO_IMG = "/images/radio-white-default.jpg";

// Every local station thumbnail ships with a 512px companion file
// (scripts/download-thumbnails.cjs) for high-DPI screens and share cards.
// Remote URLs (stations added after the deploy) have no companion.
export function stationThumb2x(url: string | null | undefined): string | null {
  if (!url?.startsWith("/station-thumbnails/") || !url.endsWith(".webp")) {
    return null;
  }
  if (url.endsWith(".2x.webp")) return url;
  return `${url.slice(0, -".webp".length)}.2x.webp`;
}

// srcSet/sizes pair for <img>s whose station-thumbnail slot is large enough
// that high-DPI screens outgrow the 256px base file. Width descriptors let
// the browser pick per DPR: a 100px slot stays on the base file at 2x but
// upgrades at 3x. Empty (attributes omitted) when there is no 2x companion —
// the 512w claim is nominal for the few originals smaller than 512, which
// ship at their real size.
export function stationThumbImgProps(
  url: string | null | undefined,
  slotPx: number,
): { srcSet?: string; sizes?: string } {
  const twoX = stationThumb2x(url);
  if (!url || !twoX || twoX === url) return {};
  return { srcSet: `${url} 256w, ${twoX} 512w`, sizes: `${slotPx}px` };
}

// 128px companion (scripts/download-thumbnails.cjs) for the small logo slots —
// station cards, favourites and the homepage live panel render 52-110 CSS px,
// where the 256px base file is 4x the pixels a phone needs.
export function stationThumbSmall(url: string | null | undefined): string | null {
  const twoX = stationThumb2x(url);
  if (!url || !twoX || twoX === url) return null;
  return `${url.slice(0, -".webp".length)}.sm.webp`;
}

// srcSet/sizes pair for small station-logo slots: the browser picks the 128px
// file while the slot needs at most 128 device pixels (a 70px card on a 1.75x
// phone) and the 256px base file it loads today above that. Empty (attributes
// omitted) for remote urls, which have no companion files.
export function stationThumbSmallImgProps(
  url: string | null | undefined,
  sizes: string,
): { srcSet?: string; sizes?: string } {
  const small = stationThumbSmall(url);
  if (!small) return {};
  return { srcSet: `${small} 128w, ${url} 256w`, sizes };
}

export function getValidImageUrl(url: string | null | undefined, fallback: string = DEFAULT_RADIO_IMG): string {
  if (!url || url === "null" || url === "undefined" || url.trim() === "") {
    return fallback;
  }
  // Reject non-URL strings like "no_cover_image.jpg" that the API returns
  // Valid URLs must start with "/" (local) or "http" (remote)
  if (!url.startsWith("/") && !url.startsWith("http")) {
    return fallback;
  }
  return url;
}

// Click-capture handler for card-style links: a mouse/touch click leaves the
// anchor focused, and Chrome promotes that invisible focus to the UA blue
// focus ring at the next keypress (Space = global play/pause). Dropping
// pointer focus prevents the promotion; keyboard activation (click detail 0)
// keeps its focus so Tab users don't lose the ring. Capture phase so inner
// stopPropagation (the favourite heart) can't skip it.
export function dropPointerFocus(e: {
  detail: number;
  currentTarget: HTMLElement;
}): void {
  if (e.detail !== 0) e.currentTarget.blur();
}

// onError handler body for artwork <img>s: advances the broken image one step
// down its fallback chain (e.g. song thumb → station thumb → default radio
// image). The current src is never re-set, so a broken station image can't
// retry-loop and the chain always terminates on the bundled default.
export function stepImageFallback(
  img: HTMLImageElement,
  ...fallbacks: Array<string | null | undefined>
): void {
  const chain: string[] = [];
  for (const candidate of [...fallbacks, DEFAULT_RADIO_IMG]) {
    const url = getValidImageUrl(candidate);
    if (!chain.includes(url)) chain.push(url);
  }
  const current = img.getAttribute("src") ?? "";
  const next = chain[chain.indexOf(current) + 1];
  if (next && next !== current) {
    // srcset candidates outrank src, so a surviving srcset would keep
    // re-selecting the broken resource instead of the fallback.
    img.removeAttribute("srcset");
    img.src = next;
  }
}
