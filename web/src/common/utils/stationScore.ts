import type { IStation } from "@/models/Station";

// Shared "Pentru tine" scoring: 50% listener reviews, 50% active listeners.
// Used by the Stations sort dropdown and by the build-time pre-sort in
// index.astro / [station_slug]/index.astro, so the SSR'd grid order matches
// the order the client settles on.

export function getReviewScore(station: IStation): number {
  const avgRating = station.reviews_stats?.average_rating || 0;
  const numReviews = station.reviews_stats?.number_of_reviews || 0;
  return avgRating * numReviews;
}

export interface StationSnapshot {
  score: number;
  listeners: number;
  rating: number;
}

export function buildScoreSnapshot(stations: IStation[]): Record<string, StationSnapshot> {
  const maxReview = Math.max(...stations.map(getReviewScore), 1);
  const maxListeners = Math.max(...stations.map((s) => s.total_listeners || 0), 1);
  const snapshot: Record<string, StationSnapshot> = {};
  for (const s of stations) {
    snapshot[s.slug] = {
      score: (getReviewScore(s) / maxReview) * 0.5 + ((s.total_listeners || 0) / maxListeners) * 0.5,
      listeners: s.total_listeners || 0,
      rating: getReviewScore(s),
    };
  }
  return snapshot;
}

export function sortByScore(stations: IStation[], scoreSnapshot: Record<string, StationSnapshot>): IStation[] {
  return [...stations].sort((a, b) => (scoreSnapshot[b.slug]?.score || 0) - (scoreSnapshot[a.slug]?.score || 0));
}

// Build-time helper — call BEFORE cleanStationsMetadata zeroes total_listeners.
export function sortStationsByRecommendedScore(stations: IStation[]): IStation[] {
  return sortByScore(stations, buildScoreSnapshot(stations));
}
