import type { IStation } from "@/models/Station";

// Pre-paint favourites contract (FavoritesPrepaint.astro): an inline script
// clones the SSR'd favourite cards into the DOM before first paint and stamps
// window.__favouriteStamp with the slugs it placed. Seeding RadioApp's initial
// context from the stamp makes React's first client render match that DOM
// exactly, so hydration adopts the pre-painted section instead of falling
// back to a client re-render (#418). No stamp (SSR / no favourites / script
// failed) → [], which matches a DOM without the section.

export function mapStampToStations(
  stamp: string[] | undefined,
  stations: IStation[],
): IStation[] {
  if (!stamp?.length) return [];
  return stamp
    .map((slug) => stations.find((s) => s.slug === slug))
    .filter((s): s is IStation => Boolean(s));
}

export function getPrepaintFavouriteStations(stations: IStation[]): IStation[] {
  if (typeof window === "undefined") return [];
  return mapStampToStations(
    (window as unknown as { __favouriteStamp?: string[] }).__favouriteStamp,
    stations,
  );
}
