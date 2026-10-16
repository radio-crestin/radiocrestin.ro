import { create } from "zustand";
import { PLAYBACK_STATE } from "@/models/enum";
import type { ISong } from "@/models/Station";

// HLS streams play 2 minutes behind the live edge so metadata can be
// fetched with the matching timestamp (same approach as the mobile app).
export const HLS_OFFSET_SECONDS = 120;

/**
 * The song the listener hears on hls.js playback, from the song changes the
 * playlist announces (EXT-X-RC-METADATA-CHANGED / EXT-X-DATERANGE) matched
 * against the PDT of the playhead.
 */
export interface IHlsNowPlaying {
  stationId: number;
  stationSlug: string;
  /** When the audible song started: its playlist boundary (epoch ms). */
  startedAt: number;
  /** From the playlist's song hint, or the history API once resolved; null
   *  until known. */
  song: ISong | null;
}

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
  /** Null when not playing through hls.js or the playlist has no song tags. */
  hlsNowPlaying: IHlsNowPlaying | null;
  setPlaybackState: (state: PLAYBACK_STATE) => void;
  setHasError: (hasError: boolean) => void;
  setHlsActive: (active: boolean) => void;
  setHlsPlaybackTimestamp: (ts: number | null) => void;
  setHlsNowPlaying: (nowPlaying: IHlsNowPlaying | null) => void;
}

const usePlaybackState = create<IPlaybackStateStore>((set) => ({
  playbackState: PLAYBACK_STATE.STOPPED,
  hasError: false,
  hlsActive: false,
  hlsPlaybackTimestamp: null,
  hlsNowPlaying: null,
  setPlaybackState: (playbackState) => set({ playbackState }),
  setHasError: (hasError) => set({ hasError }),
  setHlsActive: (hlsActive) => set({ hlsActive }),
  setHlsPlaybackTimestamp: (hlsPlaybackTimestamp) => set({ hlsPlaybackTimestamp }),
  setHlsNowPlaying: (hlsNowPlaying) => set({ hlsNowPlaying }),
}));

export default usePlaybackState;
