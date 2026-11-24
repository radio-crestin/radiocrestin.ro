import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ClickTarget, IAnnouncement } from "@/models/Announcement";
import {
  hiddenAtClick,
  withClick,
  withEvent,
  withVisit,
  type AnnouncementsLocalState,
} from "@/utils/announcements";

interface AnnouncementsStore extends AnnouncementsLocalState {
  dismiss: (slug: string) => void;
  /**
   * One more impression of `slug`; with `announcements`, also another announcement seen for
   * those whose waits count impressions.
   */
  countImpression: (slug: string, announcements?: IAnnouncement[]) => void;
  /** Counts a click for the hide rules; true when the announcement must leave the view now. */
  countClick: (announcement: IAnnouncement, target: ClickTarget | null | undefined) => boolean;
  /** A page load where announcements load, for the waits; `shown`: the slugs it shows. */
  countVisit: (announcements: IAnnouncement[], shown: string[]) => void;
  /** A station started playing, for the waits that count playbacks. */
  countPlayback: (announcements: IAnnouncement[], stationSlug: string) => void;
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
      started: {},
      waited: {},
      rotationCursor: 0,
      seen: {},
      country: undefined,

      dismiss: (slug) =>
        set((state) => ({
          dismissed: { ...state.dismissed, [slug]: new Date().toISOString() },
        })),

      countImpression: (slug, announcements) => {
        const others = announcements && withEvent(get(), announcements, { kind: "impressions", of: slug });
        if (others) set(others);
        set((state) => ({
          impressions: { ...state.impressions, [slug]: (state.impressions[slug] || 0) + 1 },
          ...(state.afterClicks[slug] !== undefined && {
            afterClicks: { ...state.afterClicks, [slug]: state.afterClicks[slug] + 1 },
          }),
        }));
      },

      countClick: (announcement, target) => {
        const counts = withClick(get(), announcement, target);
        if (counts.clicks !== get().clicks) set(counts);
        return hiddenAtClick(announcement, counts.clicks);
      },

      countVisit: (announcements, shown) => {
        const next = withVisit(get(), announcements, shown);
        if (next) set(next);
      },

      countPlayback: (announcements, stationSlug) => {
        const next = withEvent(get(), announcements, { kind: "playbacks", station: stationSlug });
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
      partialize: ({ dismissed, impressions, clicks, afterClicks, started, returns, waited, rotationCursor, seen, country }) => ({
        dismissed,
        impressions,
        clicks,
        afterClicks,
        started,
        returns,
        waited,
        rotationCursor,
        seen,
        country,
      }),
    },
  ),
);

export default useAnnouncementsStore;
