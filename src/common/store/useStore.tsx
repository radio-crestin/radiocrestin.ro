import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface IStore {
  favouriteItems: string[];
  toggleFavourite: (slug: string) => void;

  playerVolume: number;
  setPlayerVolume: (volume: number) => void;
}

const useStore = create<IStore>()(
  persist(
    (set, get) => ({
      playerVolume: 20,
      favouriteItems: [],

      toggleFavourite: (slug: string) => {
        set((state) => {
          const isFavourite = state.favouriteItems.includes(slug);
          if (isFavourite) {
            // Remove from favourites if it's already a favourite
            return {
              favouriteItems: state.favouriteItems.filter(
                (item: string) => item !== slug,
              ),
            };
          } else {
            // Add to favourites if it's not already a favourite
            return {
              favouriteItems: [...state.favouriteItems, slug],
            };
          }
        });
      },

      setPlayerVolume: (volume: number) => {
        set(() => ({
          playerVolume: volume,
        }));
      },
    }),
    {
      name: "favourites-store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export default useStore;
