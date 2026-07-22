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
          const favouriteItems = isFavourite
            ? state.favouriteItems.filter((item: string) => item !== slug)
            : [...state.favouriteItems, slug];
          trackFavoriteToggled(slug, !isFavourite, undefined, favouriteItems);
          return { favouriteItems };
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
