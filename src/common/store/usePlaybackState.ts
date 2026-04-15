import { create } from "zustand";
import { PLAYBACK_STATE } from "@/models/enum";

// HLS streams play 2 minutes behind the live edge so metadata can be
// fetched with the matching timestamp (same approach as the mobile app).
export const HLS_OFFSET_SECONDS = 120;

interface IPlaybackStateStore {
  playbackState: PLAYBACK_STATE;
  hasError: boolean;
  /** Whether HLS is the active stream type (enables offset-based metadata). */
  hlsActive: boolean;
  /**
   * Unix timestamp (seconds) of the audio currently being played, derived
   * from the HLS segment's EXT-X-PROGRAM-DATE-TIME. Updated on every
   * FRAG_CHANGED event. Null when not playing HLS.
   */
  hlsPlaybackTimestamp: number | null;
  /** Song ID detected from HLS ID3 tags — triggers immediate metadata refetch on change. */
  hlsSongId: number | null;
  setPlaybackState: (state: PLAYBACK_STATE) => void;
  setHasError: (hasError: boolean) => void;
  setHlsActive: (active: boolean) => void;
  setHlsPlaybackTimestamp: (ts: number | null) => void;
  setHlsSongId: (songId: number | null) => void;
}

const usePlaybackState = create<IPlaybackStateStore>((set) => ({
  playbackState: PLAYBACK_STATE.STOPPED,
  hasError: false,
  hlsActive: false,
  hlsPlaybackTimestamp: null,
  hlsSongId: null,
  setPlaybackState: (playbackState) => set({ playbackState }),
  setHasError: (hasError) => set({ hasError }),
  setHlsActive: (hlsActive) => set({ hlsActive }),
  setHlsPlaybackTimestamp: (hlsPlaybackTimestamp) => set({ hlsPlaybackTimestamp }),
  setHlsSongId: (hlsSongId) => set({ hlsSongId }),
}));

export default usePlaybackState;
