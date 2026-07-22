export type PlaybackSource = "favorites" | "all";

interface QueueStation {
  slug: string;
  uptime?: { is_up: boolean } | null;
}

/**
 * Pick the station `direction` steps away from `currentSlug` in the active
 * queue. The favourites list is the queue only while it can actually take the
 * user somewhere (source === "favorites" and at least one other favourite);
 * otherwise the full sorted list is used, so the buttons never go dead.
 * Offline stations are skipped — except the current one, which stays in the
 * queue so stepping remains positional — unless that would empty the queue.
 * Ends wrap around; a current slug missing from the queue lands on the first
 * (next) or last (prev) entry.
 */
export function getAdjacentStation<T extends QueueStation>(opts: {
  allStations: T[];
  favouriteStations: T[];
  source: PlaybackSource;
  currentSlug: string;
  direction: 1 | -1;
}): T | null {
  const { allStations, favouriteStations, source, currentSlug, direction } =
    opts;

  const upOnly = (list: T[]) =>
    list.filter((s) => s.uptime?.is_up !== false || s.slug === currentSlug);
  const canStep = (list: T[]) => list.some((s) => s.slug !== currentSlug);

  let queue = source === "favorites" ? upOnly(favouriteStations) : [];
  if (!canStep(queue)) queue = upOnly(allStations);
  if (!canStep(queue)) queue = allStations;
  if (!canStep(queue)) return null;

  const index = queue.findIndex((s) => s.slug === currentSlug);
  const nextIndex =
    index === -1
      ? direction === 1
        ? 0
        : queue.length - 1
      : (index + direction + queue.length) % queue.length;

  const next = queue[nextIndex];
  return next && next.slug !== currentSlug ? next : null;
}
