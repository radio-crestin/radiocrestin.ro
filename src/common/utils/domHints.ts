/**
 * Pick the DOM nodes used by the "no favourite station yet" onboarding hint.
 *
 * The original code hard-indexed `stationItems[1]` and `stationItems[2]`, which
 * throws `Cannot read properties of undefined (reading 'scrollIntoView')` when
 * fewer than 2-3 station items are rendered — e.g. stations still loading, a
 * filtered/short list, or a single station. Clamp the indices to the available
 * range and return null when there are no items so callers can guard with `?.`.
 */
export function pickStationHintTargets<T>(
  items: ArrayLike<T>,
): { scrollTarget: T | null; appendTarget: T | null } {
  const len = items.length;
  if (len === 0) return { scrollTarget: null, appendTarget: null };
  return {
    scrollTarget: items[Math.min(1, len - 1)],
    appendTarget: items[Math.min(2, len - 1)],
  };
}
