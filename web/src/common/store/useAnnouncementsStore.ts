import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ClickTarget, IAnnouncement } from "@/models/Announcement";
import { hiddenAtClick, withClick, type AnnouncementsLocalState } from "@/utils/announcements";

interface AnnouncementsStore extends AnnouncementsLocalState {
  dismiss: (slug: string) => void;
  countImpression: (slug: string) => void;
  /** Counts a click for the hide rules; true when the announcement must leave the view now. */
  countClick: (announcement: IAnnouncement, target: ClickTarget | null | undefined) => boolean;
  advanceRotation: () => void;
  markSeen: (slugs: string[]) => void;
  setCountry: (country: string | null) => void;
}

const useAnnouncementsStore = create<AnnouncementsStore>()(
  persist(
    (set, get) => ({
      dismissed: {},
      impressions: {},
      clicks: {},
      afterClicks: {},
      rotationCursor: 0,
      seen: {},
      country: undefined,

      dismiss: (slug) =>
        set((state) => ({
          dismissed: { ...state.dismissed, [slug]: new Date().toISOString() },
        })),

      countImpression: (slug) =>
        set((state) => ({
          impressions: { ...state.impressions, [slug]: (state.impressions[slug] || 0) + 1 },
          ...(state.afterClicks[slug] !== undefined && {
            afterClicks: { ...state.afterClicks, [slug]: state.afterClicks[slug] + 1 },
          }),
        })),

      countClick: (announcement, target) => {
        const counts = withClick(get(), announcement, target);
        if (counts.clicks !== get().clicks) set(counts);
        return hiddenAtClick(announcement, counts.clicks);
      },

      setCountry: (country) => set({ country }),

      advanceRotation: () => set((state) => ({ rotationCursor: state.rotationCursor + 1 })),

      markSeen: (slugs) =>
        set((state) => {
          const now = new Date().toISOString();
          const fresh = slugs.filter((slug) => !state.seen[slug]);
          if (!fresh.length) return state;
          return { seen: { ...state.seen, ...Object.fromEntries(fresh.map((slug) => [slug, now])) } };
        }),
    }),
    {
      name: "announcements-store",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ dismissed, impressions, clicks, afterClicks, rotationCursor, seen, country }) => ({
        dismissed,
        impressions,
        clicks,
        afterClicks,
        rotationCursor,
        seen,
        country,
      }),
    },
  ),
);

export default useAnnouncementsStore;
