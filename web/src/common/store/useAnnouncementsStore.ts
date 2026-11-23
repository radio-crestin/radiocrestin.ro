import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AnnouncementsLocalState } from "@/utils/announcements";

interface AnnouncementsStore extends AnnouncementsLocalState {
  dismiss: (slug: string) => void;
  countImpression: (slug: string) => void;
  advanceRotation: () => void;
  markSeen: (slugs: string[]) => void;
  setCountry: (country: string | null) => void;
}

const useAnnouncementsStore = create<AnnouncementsStore>()(
  persist(
    (set) => ({
      dismissed: {},
      impressions: {},
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
        })),

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
      partialize: ({ dismissed, impressions, rotationCursor, seen, country }) => ({
        dismissed,
        impressions,
        rotationCursor,
        seen,
        country,
      }),
    },
  ),
);

export default useAnnouncementsStore;
