import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ClickTarget, IAnnouncement } from "@/models/Announcement";
import { hiddenAtClick, withClick, withVisit, type AnnouncementsLocalState } from "@/utils/announcements";

interface AnnouncementsStore extends AnnouncementsLocalState {
  dismiss: (slug: string) => void;
  countImpression: (slug: string) => void;
  /** Counts a click for the hide rules; true when the announcement must leave the view now. */
  countClick: (announcement: IAnnouncement, target: ClickTarget | null | undefined) => boolean;
  /** A page load where announcements load, for "show it again"; `shown`: the slugs it shows. */
  countVisit: (announcements: IAnnouncement[], shown: string[]) => void;
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
      returns: {},
      hiddenVisits: {},
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

      countVisit: (announcements, shown) => {
        const next = withVisit(get(), announcements, shown);
        if (next) set(next);
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
      partialize: ({ dismissed, impressions, clicks, afterClicks, returns, hiddenVisits, rotationCursor, seen, country }) => ({
        dismissed,
        impressions,
        clicks,
        afterClicks,
        returns,
        hiddenVisits,
        rotationCursor,
        seen,
        country,
      }),
    },
  ),
);

export default useAnnouncementsStore;
