import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PlaybackSource } from "@/utils/stationQueue";

export interface IStore {
  playerVolume: number;
  // Which list the current station was picked from — drives the prev/next
  // queue. Deliberately not persisted: a hard reload lands on a station URL,
  // which counts as a direct visit and plays from the full list.
  playbackSource: PlaybackSource;
  setPlayerVolume: (volume: number) => void;
  setPlaybackSource: (source: PlaybackSource) => void;
}

const usePlayer = create<IStore>()(
  persist(
    (set, get) => ({
      playerVolume: 20,
      playbackSource: "all",

      setPlayerVolume: (volume: number) => {
        set(() => ({
          playerVolume: volume,
        }));
      },

      setPlaybackSource: (source: PlaybackSource) => {
        set(() => ({
          playbackSource: source,
        }));
      },
    }),
    {
      name: "player-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ playerVolume: state.playerVolume }),
    },
  ),
);

export default usePlayer;
