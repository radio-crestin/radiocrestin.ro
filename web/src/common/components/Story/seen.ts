// The stories this device opened (slug -> the updated_at it saw), for the bar's rings: coloured
// while new, grey once seen, new again when the admin edits the story.
import type { SeenStories } from "@/utils/stories";

const SEEN_KEY = "stories-seen";
export const SEEN_EVENT = "stories-seen";

export const readSeenStories = (): SeenStories => {
  try {
    const value = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};

export const markStorySeen = (slug: string, updatedAt: string) => {
  try {
    const seen = readSeenStories();
    if (seen[slug] !== undefined && seen[slug] >= updatedAt) return;
    localStorage.setItem(SEEN_KEY, JSON.stringify({ ...seen, [slug]: updatedAt }));
    window.dispatchEvent(new Event(SEEN_EVENT));
  } catch {
    // storage full or blocked: the ring just stays coloured
  }
};
