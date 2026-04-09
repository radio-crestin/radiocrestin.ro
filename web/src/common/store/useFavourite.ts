import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { trackFavoriteToggled } from "@/utils/posthog";

export interface IStore {
  favouriteItems: string[];
  toggleFavourite: (slug: string) => void;
}

const useFavourite = create<IStore>()(
  persist(
    // @ts-ignore
    (set, get) => ({
      favouriteItems: [],

      toggleFavourite: (slug: string) => {
        set((state) => {
          const isFavourite = state.favouriteItems.includes(slug);
          trackFavoriteToggled(slug, !isFavourite);
          if (isFavourite) {
            return {
              favouriteItems: state.favouriteItems.filter(
                (item: string) => item !== slug,
              ),
            };
          } else {
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
