import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface IStore {
  playerVolume: number;
  setPlayerVolume: (volume: number) => void;
}

const usePlayer = create<IStore>()(
  persist(
    (set, get) => ({
      playerVolume: 20,

      setPlayerVolume: (volume: number) => {
        set(() => ({
          playerVolume: volume,
        }));
      },
    }),
    {
      name: "player-store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export default usePlayer;
