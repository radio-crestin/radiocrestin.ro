// Station playbacks, for the announcement waits that count them (count_on: playbacks). The player
// is in the main bundle and the announcements code is a lazy chunk (or not on the page at all, e.g.
// the category pages): until it counts them, playbacks wait in localStorage. Keep this file tiny.

const KEY = "announcements-playbacks";
/** Enough for any wait the admin sets; older ones are dropped. */
const MAX_PENDING = 500;

let counter: ((stationSlug: string) => void) | null = null;

const readPending = (): string[] => {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
};

/** A station started playing on this device. */
export const reportPlayback = (stationSlug: string) => {
  if (counter) return counter(stationSlug);
  try {
    localStorage.setItem(KEY, JSON.stringify([...readPending(), stationSlug].slice(-MAX_PENDING)));
  } catch {
    // storage full or blocked: this playback isn't counted
  }
};

/** The announcements code took over: it counts the pending playbacks, then every new one. */
export const countPlaybacksWith = (count: (stationSlug: string) => void) => {
  counter = count;
  const pending = readPending();
  if (!pending.length) return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // blocked: they were never stored either
  }
  pending.forEach(count);
};
