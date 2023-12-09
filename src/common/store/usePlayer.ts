import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { PLAYBACK_STATE } from "@/models/enum";

export interface IStore {
  playerVolume: number;
  setPlayerVolume: (volume: number) => void;

  playbackState: PLAYBACK_STATE;
  setPlaybackState: (state: PLAYBACK_STATE) => void;
}

const usePlayer = create<IStore>()(
  persist(
    (set, get) => ({
      playerVolume: 20,
      playbackState: PLAYBACK_STATE.STOPPED,

      setPlayerVolume: (volume: number) => {
        set(() => ({
          playerVolume: volume,
        }));
      },

      setPlaybackState: (state: PLAYBACK_STATE) => {
        set(() => ({
          playbackState: state,
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
