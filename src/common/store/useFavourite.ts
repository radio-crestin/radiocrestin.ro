import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface IStore {
  favouriteItems: string[];
  toggleFavourite: (slug: string) => void;
}

const useFavourite = create<IStore>()(
  persist(
    (set, get) => ({
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
    }),
    {
      name: "favourites-store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export default useFavourite;
