import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface IFavouritesStore {
  isFavorite: { [key: string]: boolean };
  addOrRemoveFavourite: (slug: string) => void;
}

const useStore = create<IFavouritesStore>()(
  persist(
    (set, get) => ({
      isFavorite: {},

      // Function to add or remove a favourite
      addOrRemoveFavourite: (slug: string) => {
        set((state: any) => {
          const isFavourite = state.isFavorite[slug];
          return {
            isFavorite: {
              ...state.isFavorite,
              [slug]: !isFavourite,
            },
          };
        });
      },
    }),
    {
      name: "favourites-store", // name of localStorage key
      storage: createJSONStorage(() => localStorage), // use localStorage
    },
  ),
);

export default useStore;
