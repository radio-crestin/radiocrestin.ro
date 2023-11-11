import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { IStation } from "@/models/Station";

export interface IFavouritesStore {
  stations: IStation[];
  favourites: string[];
  setStations: (stations: any) => void;
  addOrRemoveFavourite: (slug: string) => void;
}

const useStore = create<IFavouritesStore>()(
  persist(
    (set, get) => ({
      stations: [],
      favourites: [],

      setStations: (state) => {
        set({ stations: state });
      },

      // Function to add or remove a favourite
      addOrRemoveFavourite: (slug: string) => {
        set((state: any) => {
          const isFavourite = state.favourites.includes(slug);
          return {
            favourites: isFavourite
              ? state.favourites.filter((favSlug: string) => favSlug !== slug)
              : [...state.favourites, slug],
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
