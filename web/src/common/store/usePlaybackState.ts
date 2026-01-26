import { create } from "zustand";
import { PLAYBACK_STATE } from "@/models/enum";

interface IPlaybackStateStore {
  playbackState: PLAYBACK_STATE;
  hasError: boolean;
  setPlaybackState: (state: PLAYBACK_STATE) => void;
  setHasError: (hasError: boolean) => void;
}

const usePlaybackState = create<IPlaybackStateStore>((set) => ({
  playbackState: PLAYBACK_STATE.STOPPED,
  hasError: false,
  setPlaybackState: (playbackState) => set({ playbackState }),
  setHasError: (hasError) => set({ hasError }),
}));

export default usePlaybackState;
