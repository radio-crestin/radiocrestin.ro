import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface PlayCountStore {
  playCounts: Record<string, number>;
  incrementPlayCount: (slug: string) => void;
}

const usePlayCount = create<PlayCountStore>()(
  persist(
    (set) => ({
      playCounts: {},

      incrementPlayCount: (slug: string) => {
        set((state) => ({
          playCounts: {
            ...state.playCounts,
            [slug]: (state.playCounts[slug] || 0) + 1,
          },
        }));
      },
    }),
    {
      name: "play-count-store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export default usePlayCount;
