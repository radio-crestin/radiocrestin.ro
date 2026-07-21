"use client";

import React, { useContext, useEffect, useRef, useState } from "react";
import type HlsType from "hls.js";
import type { HlsConfig } from "hls.js";

let HlsModule: typeof import("hls.js") | null = null;
const getHls = async () => {
  if (!HlsModule) {
    HlsModule = await import("hls.js");
  }
  return HlsModule.default;
};
import useSpaceBarPress from "@/hooks/useSpaceBarPress";
import useSwapTransition from "@/hooks/useSwapTransition";
import { Loading } from "@/icons/Loading";
import { CONSTANTS, SHARE_URL } from "@/constants/constants";
import styles from "./styles.module.scss";
import { Context } from "@/context/ContextProvider";
import usePlayer from "@/store/usePlayer";
import usePlaybackState, { HLS_OFFSET_SECONDS } from "@/store/usePlaybackState";
import { PLAYBACK_STATE } from "@/models/enum";
import { toast } from "react-toastify";
import Heart from "@/icons/Heart";
import useFavourite from "@/store/useFavourite";
import { captureException, getUserId, trackListeningStarted, trackListeningStopped, trackListeningStoppedBeacon, trackStationOpened } from "@/utils/posthog";
import type { IStationStreams } from "@/models/Station";
import OfflineStatus from "@/components/OfflineStatus";
import HeadphoneIcon from "@/icons/Headphone";
import { getStationSongHistory } from "@/services/getStations";
import type { ISongHistoryItem } from "@/services/getStations";
import { canAutoplayAudio } from "@/utils/autoplay";
import usePlayCount from "@/store/usePlayCount";
import { useRefreshStations } from "@/hooks/useUpdateStationsMetadata";
import { getValidImageUrl, roPlural, stepImageFallback } from "@/utils";

enum STREAM_TYPE {
  HLS = "HLS",
  PROXY = "proxied_stream",
  ORIGINAL = "direct_stream",
}

const MAX_MEDIA_RETRIES = 20;

// No silent audio hack needed — we keep the HLS instance alive on pause
// (with hls.stopLoad() to stop bandwidth) so the audio element stays
// connected to MediaSession and retains media key focus.

export default function RadioPlayer() {
  const { ctx, setCtx } = useContext(Context);
  const { playerVolume, setPlayerVolume } = usePlayer();
  const { playbackState, setPlaybackState, setHasError, setHlsActive, setHlsPlaybackTimestamp, setHlsSongId } = usePlaybackState();
  const station = ctx.selectedStation;
  const retriesRef = useRef(MAX_MEDIA_RETRIES);
  const [streamState, setStreamState] = useState<{ type: STREAM_TYPE; slug: string } | null>(null);
  const streamType = streamState?.slug === station.slug ? streamState?.type ?? null : null;
  const { favouriteItems, toggleFavourite } = useFavourite();
  const { incrementPlayCount } = usePlayCount();
  const { refreshStations } = useRefreshStations();
  const [isFavorite, setIsFavorite] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [history, setHistory] = useState<ISongHistoryItem[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  // Mobile song ticker: scrolls only when the text overflows its container.
  const tickerRef = useRef<HTMLDivElement>(null);
  const [tickerMarquee, setTickerMarquee] = useState(false);
  const [tickerDuration, setTickerDuration] = useState(16);
  // Slug of the station that was preselected without a user gesture (page-load
  // deep link or category default); its stream is not loaded until the autoplay
  // probe allows it or the user actually presses play.
  const autoSelectedNoLoadRef = useRef<string | null>(null);
  const hlsInstanceRef = useRef<HlsType | null>(null);
  const isPausedRef = useRef(false); // true = HLS paused with stopLoad(), resumable
  const retryMechanismRef = useRef<() => void>(() => {});
  const hlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hlsRecoveryRef = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);
  const isDestroyingRef = useRef(false);
  // Maps fragment programDateTime (epoch ms) -> song_id parsed from ID3 frames.
  // Populated when fragments are parsed (ahead of playback) and read at FRAG_CHANGED
  // so we attribute song_id to the audio that's actually playing — not to a future
  // fragment still in the buffer.
  const fragSongIdsRef = useRef<Map<number, number>>(new Map());
  const [loadKey, setLoadKey] = useState(0);
  const prevLoadKeyRef = useRef(0);
  const listeningStartRef = useRef<{ time: number; slug: string; title: string; id: number } | null>(null);
  // true = playback was interrupted by a network loss and should auto-resume
  // as soon as the connection is back. Cleared on user stop / successful play.
  const waitingForNetworkRef = useRef(false);
  const onlineRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHlsTimeout = () => {
    if (hlsTimeoutRef.current) {
      clearTimeout(hlsTimeoutRef.current);
      hlsTimeoutRef.current = null;
    }
  };

  // Central cleanup: destroys current HLS instance or cancels non-HLS audio download,
  // clears timeouts and listeners.
  // Suppresses spurious onPause events fired by hls.destroy() → media.load().
  const destroyCurrentStream = () => {
    isDestroyingRef.current = true;
    clearHlsTimeout();
    // Null the ref BEFORE destroy — hls.destroy() fires synchronous events,
    // and HLS callbacks guard with `hls !== hlsInstanceRef.current`.
    // If the ref still points to the instance, those guards would not suppress callbacks.
    if (cleanupRef.current) {
      const cleanup = cleanupRef.current;
      cleanupRef.current = null;
      hlsInstanceRef.current = null;
      cleanup();
    } else if (hlsInstanceRef.current) {
      const hls = hlsInstanceRef.current;
      hlsInstanceRef.current = null;
      hls.destroy();
    } else {
      // Non-HLS stream (proxy/direct MP3): pause and cancel the pending download.
      // Without this, the old audio.src request continues and its events
      // (onPause, onError) can fire after isDestroyingRef resets, killing the
      // new station's stream.
      const audio = document.getElementById("audioPlayer") as HTMLAudioElement;
      if (audio && audio.src) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
    }
    // Reset after macrotask — media.load() fires pause synchronously,
    // but some browsers may queue it. setTimeout ensures we cover both.
    setTimeout(() => { isDestroyingRef.current = false; }, 0);
  };

  const handlePlayError = (error: any, context: string) => {
    // Autoplay blocked: nothing will ever start this stream, so show the play
    // button. Must run before the destroy guard — play() rejects a microtask
    // before isDestroyingRef resets (macrotask), and swallowing the rejection
    // would strand the spinner on BUFFERING with no event left to clear it.
    if (error.name === 'NotAllowedError') {
      setPlaybackState(PLAYBACK_STATE.STOPPED);
      return;
    }
    // Ignore errors from intentional cancellation (station switch or user pause)
    if (error.name === 'AbortError' || isDestroyingRef.current) return;
    captureException(error, `${context} - station: ${station.title}`);
    retryMechanism();
  };

  // Streams driven by the bare <audio> element (MP3 proxy/direct, and native
  // HLS on iOS Safari) never reconnect on their own: when the socket dies
  // (network switch, brief offline) the element stalls silently, usually
  // without firing an error event. Poll currentTime and retry when it stops
  // advancing while we're supposed to be playing. hls.js streams are covered
  // by their own stuck-detection instead.
  const startStallWatchdog = (audio: HTMLAudioElement) => {
    let lastTime = -1;
    let stalledChecks = 0;
    const interval = setInterval(() => {
      // Background tabs throttle timers and may legitimately pause loading;
      // recovery happens on the next visible check.
      if (typeof document !== "undefined" && document.hidden) return;
      const { playbackState: current } = usePlaybackState.getState();
      if (current !== PLAYBACK_STATE.PLAYING && current !== PLAYBACK_STATE.BUFFERING) {
        lastTime = audio.currentTime;
        stalledChecks = 0;
        return;
      }
      if (audio.currentTime > lastTime) {
        lastTime = audio.currentTime;
        stalledChecks = 0;
        return;
      }
      stalledChecks++;
      if (stalledChecks >= 3) {
        stalledChecks = 0;
        lastTime = audio.currentTime;
        console.warn("[Player] Stream stalled with no playback progress, retrying");
        retryMechanismRef.current();
      }
    }, 3500);
    return () => clearInterval(interval);
  };

  // Determine best stream type + reset retries on station change
  useEffect(() => {
    trackStationOpened(station.slug, station.title, station.id);

    // End previous listening session if station changed while playing
    if (listeningStartRef.current && listeningStartRef.current.slug !== station.slug) {
      const durationSeconds = (Date.now() - listeningStartRef.current.time) / 1000;
      trackListeningStopped(listeningStartRef.current.slug, listeningStartRef.current.title, durationSeconds, "station_switch", listeningStartRef.current.id);
      listeningStartRef.current = null;
    }

    const audio = document.getElementById("audioPlayer") as HTMLAudioElement;
    if (audio) audio.volume = playerVolume / 100;

    const preferredStreamOrder = [
      STREAM_TYPE.HLS,
      STREAM_TYPE.PROXY,
      STREAM_TYPE.ORIGINAL,
    ];

    const availableStreamType = preferredStreamOrder.find((type) =>
      station.station_streams.some(
        (stream: IStationStreams) => stream.type === type,
      ),
    );

    setStreamState(availableStreamType ? { type: availableStreamType, slug: station.slug } : null);
    setHlsActive(availableStreamType === STREAM_TYPE.HLS);

    return () => {
      setStreamState(null);
      setHlsActive(false);
      setHlsPlaybackTimestamp(null);
      setHlsSongId(null);
      retriesRef.current = MAX_MEDIA_RETRIES;
      isPausedRef.current = false;
      waitingForNetworkRef.current = false;
    };
  }, [station.slug]);

  useEffect(() => {
    setIsFavorite(favouriteItems.includes(station.slug));
  }, [favouriteItems, station.slug]);

  const nowSong = station?.now_playing?.song;
  const songText = nowSong?.name
    ? `${nowSong.name}${nowSong.artist?.name ? " · " + nowSong.artist.name : ""}`
    : "";
  const isStationUp = station.uptime?.is_up !== false;

  // "Now playing" menu actions
  const youtubeSearchUrl = nowSong?.name
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(
        `${nowSong.name} ${nowSong.artist?.name || ""}`.trim(),
      )}`
    : null;

  const openRecentSongs = () => {
    setMenuOpen(false);
    if (ctx.inPagePlayback) {
      setExpanded(true);
    } else {
      // Station pages: the SongHistory modal lives in the hero (Header) — ask it to open
      window.dispatchEvent(new Event("rc:open-song-history"));
    }
  };

  // Toggle on click only — the browser fires it just for a completed tap and
  // suppresses it when the gesture turns into a scroll, so a scroll that
  // starts on the row never opens/closes the menu. The handler lives on the
  // whole card (.radio_player) so its padding toggles too; the menu and the
  // expanded panel opt out via data-menu-ignore.
  const isRowControl = (target: EventTarget | null) =>
    !!(target as HTMLElement | null)?.closest?.(
      "button, input, a, [data-menu-ignore]",
    );

  const onRowClick = (e: React.MouseEvent) => {
    if (isRowControl(e.target)) return;
    const target = e.target as HTMLElement | null;
    // Desktop (precise pointer): only the station text block — the element
    // that also carries the role=button semantics — toggles the options;
    // the rest of the pill stays neutral. Cursor rules in SCSS mirror this.
    if (window.matchMedia?.("(min-width: 768px)").matches) {
      if (!target?.closest?.("[data-player-info]")) return;
      setMenuOpen((v) => !v);
      return;
    }
    // Mobile: closed, the whole card (padding included) opens it. While the
    // menu or the panel is open the card is in "menu mode": only a deliberate
    // tap on the player row or the chevron toggles — grazing the card padding
    // next to the open content must not act.
    if (
      (menuOpen || expanded) &&
      !target?.closest?.("[data-player-row], [data-player-handle]")
    ) {
      return;
    }
    setMenuOpen((v) => !v);
  };

  const shareStation = async () => {
    setMenuOpen(false);
    const url = `${SHARE_URL}/${station.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: station.title,
          text: `Ascultă și tu ${station.title}`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Linkul stației a fost copiat");
      }
    } catch {
      // Share sheet dismissed — nothing to do
    }
  };

  // Two-phase song-line swap (mirrors the hero's now-playing handoff): the
  // rendered text trails the live data by one 170ms fade-out, then the new
  // song rises into place. Plays for the SSR'd → live handoff and song changes.
  const { shown: shownSongText, anim: songAnim } = useSwapTransition(songText);

  useEffect(() => {
    setTickerMarquee(false);
  }, [shownSongText, station.slug]);

  // Re-measure on resize: a line that fit can overflow after the window narrows
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setTickerMarquee(false), 200);
    };
    window.addEventListener("resize", onResize);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (tickerMarquee) return;
    const el = tickerRef.current;
    if (!el || !shownSongText) return;
    // Static (clipped with ellipsis) for reduced-motion users
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (el.scrollWidth > el.clientWidth + 1) {
      // ≈16px/s — calm enough to read along
      setTickerDuration(Math.max(18, Math.round(el.scrollWidth / 16)));
      setTickerMarquee(true);
    }
  }, [tickerMarquee, shownSongText]);

  // Load the recent-songs list for the expanded panel (category pages only)
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistory(null);
    getStationSongHistory(station.slug)
      .then((response) => {
        if (cancelled) return;
        const items = (response?.history || [])
          .filter((item) => item.song?.name)
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          )
          .slice(0, 12);
        setHistory(items);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, station.slug]);

  // While the menu/panel is open, a transparent backdrop shields the page:
  // an outside tap lands on it and only dismisses — it never activates the
  // station card / control underneath. Page scrolling still chains through
  // the backdrop, so a scroll behind the menu dismisses it here instead
  // (scrolls inside the player's own scrollers — the expanded history list —
  // don't count).
  useEffect(() => {
    if (!expanded && !menuOpen) return;
    const closeAll = () => {
      setExpanded(false);
      setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAll();
    };
    const onScroll = (event: Event) => {
      if (
        playerContainerRef.current &&
        event.target instanceof Node &&
        playerContainerRef.current.contains(event.target)
      ) {
        return;
      }
      closeAll();
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [expanded, menuOpen]);

  // A station switch invalidates the open menu's context (song, favorite state)
  useEffect(() => {
    setMenuOpen(false);
  }, [station.slug]);

  useEffect(() => {
    const audio = document.getElementById("audioPlayer") as HTMLAudioElement;
    if (!audio) return;
    audio.volume = playerVolume / 100;
  }, [playerVolume]);

  const isHttpMixedContent = (url: string) => {
    return (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      url.startsWith('http://')
    );
  };

  const openHttpStream = (streamUrl: string) => {
    // Position popup at bottom center of screen
    const popupWidth = 420;
    const popupHeight = 180;
    const left = Math.round((screen.width - popupWidth) / 2);
    const top = Math.round(screen.availHeight - popupHeight - 60);

    window.open(
      streamUrl,
      `http-player-${station.slug}`,
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},menubar=no,toolbar=no,status=no,resizable=yes`,
    );

    setPlaybackState(PLAYBACK_STATE.STOPPED);
  };

  const getStreamUrl = (type: STREAM_TYPE | null) => {
    if (!type) return null;
    const stream = station.station_streams.find(
      (stream: IStationStreams) => stream.type === type,
    );
    if (!stream?.stream_url) return null;

    // Add session tracking (only on client side)
    const url = new URL(stream.stream_url);

    if (typeof window !== 'undefined') {
      url.searchParams.set('ref', window.location.hostname);
      url.searchParams.set('s', getUserId());
    }

    return url.toString();
  };

  // Maximum seconds without a new fragment loaded before we consider HLS stuck
  // (e.g. transcoder restart producing a broken m3u8). After this, fall back.
  const HLS_STUCK_TIMEOUT_MS = 15_000;

  const HLS_CONFIG: Partial<HlsConfig> = {
    // Play 2 minutes behind the live edge so metadata (fetched with the
    // same offset) matches the audio the user actually hears.
    // Same approach as the mobile app's SeekModeManager.
    liveSyncDuration: HLS_OFFSET_SECONDS,
    liveMaxLatencyDuration: HLS_OFFSET_SECONDS + 30,
    // All policies: 3 retries with backoff. Handles transient 400s from
    // transcoder restarts producing new m3u8 playlists.
    manifestLoadPolicy: {
      default: {
        maxTimeToFirstByteMs: 3000,
        maxLoadTimeMs: 5000,
        timeoutRetry: { maxNumRetry: 3, retryDelayMs: 1000, maxRetryDelayMs: 3000 },
        errorRetry: { maxNumRetry: 3, retryDelayMs: 1000, maxRetryDelayMs: 3000 },
      },
    },
    playlistLoadPolicy: {
      default: {
        maxTimeToFirstByteMs: 3000,
        maxLoadTimeMs: 5000,
        timeoutRetry: { maxNumRetry: 3, retryDelayMs: 1000, maxRetryDelayMs: 3000 },
        errorRetry: { maxNumRetry: 3, retryDelayMs: 1000, maxRetryDelayMs: 3000 },
      },
    },
    fragLoadPolicy: {
      default: {
        maxTimeToFirstByteMs: 3000,
        maxLoadTimeMs: 8000,
        timeoutRetry: { maxNumRetry: 3, retryDelayMs: 1000, maxRetryDelayMs: 4000 },
        errorRetry: { maxNumRetry: 3, retryDelayMs: 1000, maxRetryDelayMs: 4000 },
      },
    },
  };

  // Returns a cleanup function that removes HLS listeners and timeouts
  const loadHLS = (
    hls_stream_url: string,
    audio: HTMLAudioElement,
    hls: HlsType,
    Hls: typeof HlsType,
  ): (() => void) => {
    let manifestParsed = false;
    let onCanPlayThrough: (() => void) | null = null;
    let stuckTimer: ReturnType<typeof setTimeout> | null = null;
    // audio.currentTime at the last observed progress event. Used as a positive
    // signal in the stuck-callback: if the audio element is making playback
    // progress, we are not stuck regardless of whether FRAG_LOADED fired.
    let lastSeenCurrentTime = 0;

    const clearStuckTimer = () => {
      if (stuckTimer) {
        clearTimeout(stuckTimer);
        stuckTimer = null;
      }
    };

    const checkStuck = () => {
      stuckTimer = null;
      if (hls !== hlsInstanceRef.current || isPausedRef.current) return;
      // Defense against the iOS-freeze race: the timer may have been scheduled
      // while visible, and the page was suspended before visibilitychange could
      // dispatch and clear it. When JS resumes, the queued setTimeout fires —
      // re-check the live visibility state and bail (visibilitychange will rearm).
      if (typeof document !== "undefined" && document.hidden) return;
      // Positive progress signal: audio element advancement is the ground truth.
      // If audio.currentTime advanced since the last reset, the stream is fine
      // even if FRAG_LOADED was throttled (mobile background, slow network).
      if (audio.currentTime > lastSeenCurrentTime + 0.1) {
        lastSeenCurrentTime = audio.currentTime;
        stuckTimer = setTimeout(checkStuck, HLS_STUCK_TIMEOUT_MS);
        return;
      }
      console.warn("[HLS] Stuck — no fragment loaded for", HLS_STUCK_TIMEOUT_MS, "ms, switching stream");
      captureException(new Error(`HLS stuck timeout - station: ${station.title}`));
      retryMechanismRef.current();
    };

    const resetStuckTimer = () => {
      lastSeenCurrentTime = audio.currentTime;
      clearStuckTimer();
      // Mobile browsers throttle JS timers and network when the tab is hidden.
      // Skip arming until visible — visibilitychange will rearm with a fresh window.
      if (typeof document !== "undefined" && document.hidden) return;
      stuckTimer = setTimeout(checkStuck, HLS_STUCK_TIMEOUT_MS);
    };

    const onVisibilityChange = () => {
      if (hls !== hlsInstanceRef.current || isPausedRef.current) return;
      if (document.hidden) {
        clearStuckTimer();
      } else if (manifestParsed) {
        // Foreground again — give HLS a fresh window to load a fragment
        resetStuckTimer();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    clearHlsTimeout();
    hlsRecoveryRef.current = 0;

    if (Hls.isSupported()) {
      hls.loadSource(hls_stream_url);
      hls.attachMedia(audio);
    } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
      audio.src = hls_stream_url;
    }

    // 3-second timeout: if HLS manifest isn't parsed, fall back to next stream type
    hlsTimeoutRef.current = setTimeout(() => {
      if (!manifestParsed && hls === hlsInstanceRef.current) {
        hlsTimeoutRef.current = null;
        retryMechanismRef.current();
      }
    }, 3000);

    hls.on(Hls.Events.AUDIO_TRACK_LOADING, function () {
      if (hls !== hlsInstanceRef.current) return;
      setPlaybackState(PLAYBACK_STATE.BUFFERING);
    });

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (hls !== hlsInstanceRef.current) return;
      manifestParsed = true;
      clearHlsTimeout();
      setPlaybackState(PLAYBACK_STATE.BUFFERING);
      // Start stuck detection — if no fragment loads within the timeout, bail
      resetStuckTimer();
      onCanPlayThrough = () => {
        onCanPlayThrough = null;
        if (isPausedRef.current) return;
        audio.play().catch(() => {
          setPlaybackState(PLAYBACK_STATE.STOPPED);
        });
      };
      audio.addEventListener("canplaythrough", onCanPlayThrough, { once: true });
    });

    // Each loaded fragment resets the stuck timer
    hls.on(Hls.Events.FRAG_LOADED, () => {
      if (hls !== hlsInstanceRef.current) return;
      resetStuckTimer();
    });

    // Track the actual playback timestamp from EXT-X-PROGRAM-DATE-TIME, plus
    // the per-fragment song_id parsed earlier. Use the END of the fragment as
    // the metadata query timestamp so song boundaries that fall mid-fragment
    // (or just after the fragment's PDT, i.e. inside the same second) don't
    // make the API return the previous song.
    hls.on(Hls.Events.FRAG_CHANGED, (_event, data) => {
      if (hls !== hlsInstanceRef.current) return;
      const pdt = data.frag.programDateTime;
      if (pdt) {
        const fragMs = (data.frag.duration ?? 0) * 1000;
        const queryMs = pdt + Math.max(0, fragMs - 1);
        const epochSec = Math.floor(queryMs / 1000);
        setHlsPlaybackTimestamp(epochSec);
        const songId = fragSongIdsRef.current.get(pdt);
        if (songId != null) {
          // Only fires the metadata hook when the song_id actually changes.
          setHlsSongId(songId);
        }
      }
    });

    // ID3 metadata from HLS segments — store per-fragment song_id keyed by PDT.
    // The backend injects TXXX frames with "song_id\0<id>" into every .ts segment.
    // We don't push to state here: parsing fires for fragments queued ahead of
    // the audio, so attributing them to "now playing" causes display to update
    // before the audio actually reaches that song.
    hls.on(Hls.Events.FRAG_PARSING_METADATA, (_event, data) => {
      if (hls !== hlsInstanceRef.current) return;
      const pdt = data.frag.programDateTime;
      if (!pdt) return;
      for (const sample of data.samples) {
        try {
          const text = new TextDecoder("utf-8", { fatal: false }).decode(sample.data);
          const match = text.match(/song_id\0(\d+)/);
          if (match) {
            const songId = parseInt(match[1], 10);
            if (!isNaN(songId)) {
              const map = fragSongIdsRef.current;
              map.set(pdt, songId);
              // Keep ~20 minutes of fragments at 6s each; evict oldest insertion order
              while (map.size > 200) {
                const oldest = map.keys().next().value;
                if (oldest === undefined) break;
                map.delete(oldest);
              }
            }
          }
        } catch {
          // Ignore parse errors from non-text ID3 frames
        }
      }
    });

    let isRecovering = false;
    hls.on(Hls.Events.ERROR, function (event, data) {
      if (hls !== hlsInstanceRef.current) return;
      if (!data.fatal || isRecovering) return;
      isRecovering = true;
      clearHlsTimeout();

      const errorInfo = `HLS Fatal error - station: ${station.title}, type: ${data.type}, details: ${data.details}`;

      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        // Corrupt segment: recoverMediaError() would re-download the same bad bytes
        if (data.details === Hls.ErrorDetails.FRAG_PARSING_ERROR) {
          console.warn(`[HLS] Corrupt segment, switching stream:`, data.details);
          isRecovering = false;
          captureException(new Error(errorInfo));
          retryMechanismRef.current();
          return;
        }

        // Other media errors (buffer issues): MediaSource reset helps
        if (hlsRecoveryRef.current < 3) {
          hlsRecoveryRef.current++;
          console.warn(`[HLS] Recovering media error (attempt ${hlsRecoveryRef.current}):`, data.details);
          hls.recoverMediaError();
          setTimeout(() => { isRecovering = false; }, 100);
          return;
        }
      }

      // Network errors
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        const httpStatus = data.response?.code;
        // Permanent HTTP errors — in-place retry cannot help
        if (httpStatus === 403 || httpStatus === 410) {
          console.warn(`[HLS] Permanent network error (HTTP ${httpStatus}, ${data.details}), switching stream`);
          isRecovering = false;
          captureException(new Error(errorInfo));
          retryMechanismRef.current();
          return;
        }

        // Transient errors (400, 404, timeouts, network hiccups) — recoverable.
        // 400/404 often happen during transcoder restarts when a new m3u8 arrives
        // referencing segments that don't exist yet. Restarting from live edge helps.
        if (hlsRecoveryRef.current < 3) {
          hlsRecoveryRef.current++;
          console.warn(`[HLS] Recovering network error (attempt ${hlsRecoveryRef.current}, HTTP ${httpStatus}):`, data.details);
          hls.startLoad(-1);
          resetStuckTimer();
          setTimeout(() => { isRecovering = false; }, 100);
          return;
        }
      }

      // Recovery exhausted or unknown error — fall back to stream cycling
      isRecovering = false;
      captureException(new Error(errorInfo));
      retryMechanismRef.current();
    });

    return () => {
      clearHlsTimeout();
      clearStuckTimer();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      if (onCanPlayThrough) {
        audio.removeEventListener("canplaythrough", onCanPlayThrough);
      }
      fragSongIdsRef.current.clear();
      hls.destroy();
    };
  };

  useEffect(() => {
    const audio = document.getElementById("audioPlayer") as HTMLAudioElement;
    if (!audio) return;

    switch (playbackState) {
      case PLAYBACK_STATE.STARTED:
        // Always create a fresh HLS instance on resume. The paused instance's
        // buffer and playlist are stale (segments have rolled off the live
        // window), so startLoad() would fail and trigger the stuck timer.
        // The loadKey bump re-runs the stream-loader effect, whose cleanup
        // destroys the existing HLS before creating a new one.
        isPausedRef.current = false;
        incrementPlayCount(station.slug);
        trackListeningStarted(station.slug, station.title, station.id);
        listeningStartRef.current = { time: Date.now(), slug: station.slug, title: station.title, id: station.id };
        setLoadKey(k => k + 1);
        break;
      case PLAYBACK_STATE.STOPPED:
        // A stop (user or exhausted retries) cancels any pending network auto-resume
        waitingForNetworkRef.current = false;
        if (listeningStartRef.current) {
          const durationSeconds = (Date.now() - listeningStartRef.current.time) / 1000;
          trackListeningStopped(listeningStartRef.current.slug, listeningStartRef.current.title, durationSeconds, "stop", listeningStartRef.current.id);
          listeningStartRef.current = null;
        }
        // If HLS is active, pause without destroying — keeps MediaSession focus
        if (hlsInstanceRef.current) {
          isPausedRef.current = true;
          hlsInstanceRef.current.stopLoad();
          audio.pause();
        } else {
          audio.pause();
          destroyCurrentStream();
        }
        // Tell the OS we're paused so media controls show the play button
        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "paused";
        }
        break;
    }
  }, [playbackState]);

  // Send listening_stopped on tab close/navigate away
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (listeningStartRef.current) {
        const durationSeconds = (Date.now() - listeningStartRef.current.time) / 1000;
        trackListeningStoppedBeacon(
          listeningStartRef.current.slug,
          listeningStartRef.current.title,
          durationSeconds,
          "tab_closed",
          listeningStartRef.current.id,
        );
        listeningStartRef.current = null;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Auto-resume after a network interruption (brief offline / network switch).
  // While offline, failures set waitingForNetworkRef instead of burning retries;
  // once the connection is back we restart fresh from the preferred stream type.
  useEffect(() => {
    const clearRestartTimer = () => {
      if (onlineRestartTimerRef.current) {
        clearTimeout(onlineRestartTimerRef.current);
        onlineRestartTimerRef.current = null;
      }
    };

    const onOnline = () => {
      if (!waitingForNetworkRef.current) return;
      // Give the connection a moment to settle (DNS/DHCP after a network switch)
      clearRestartTimer();
      onlineRestartTimerRef.current = setTimeout(() => {
        onlineRestartTimerRef.current = null;
        // Bail if playback recovered by itself or the user stopped meanwhile
        if (!waitingForNetworkRef.current) return;
        waitingForNetworkRef.current = false;
        retriesRef.current = MAX_MEDIA_RETRIES;
        hlsRecoveryRef.current = 0;
        // Offline churn may have downgraded the stream — restart from the best one
        const preferred = [
          STREAM_TYPE.HLS,
          STREAM_TYPE.PROXY,
          STREAM_TYPE.ORIGINAL,
        ].find((type) =>
          station.station_streams.some(
            (stream: IStationStreams) => stream.type === type,
          ),
        );
        setStreamState(preferred ? { type: preferred, slug: station.slug } : null);
        setHlsActive(preferred === STREAM_TYPE.HLS);
        setPlaybackState(PLAYBACK_STATE.BUFFERING);
        setLoadKey((k) => k + 1);
      }, 1000);
    };

    const onOffline = () => {
      clearRestartTimer();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearRestartTimer();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [station.slug]);

  // Stream loader effect — single owner of HLS lifecycle
  useEffect(() => {
    const loadKeyChanged = loadKey !== prevLoadKeyRef.current;
    prevLoadKeyRef.current = loadKey;

    const audio = document.getElementById("audioPlayer") as HTMLAudioElement;
    if (!audio || !streamType) return;

    // If this re-run was triggered by loadKey (resume) but user already stopped
    // (e.g. clicked play then immediately paused — React batches both), bail out.
    if (loadKeyChanged && playbackState === PLAYBACK_STATE.STOPPED) return;

    // The first station selection after page load (station-page deep link, or
    // a category page's restored/default pick) happens without a user gesture,
    // so play() would either reject (NotAllowedError) or hang forever on live
    // MP3 streams — don't load anything yet. Probe autoplay permission and
    // either start as if the visitor pressed play, or stay STOPPED so the UI
    // shows the play button instead of an endless spinner.
    if (autoSelectedNoLoadRef.current === null && !loadKeyChanged) {
      autoSelectedNoLoadRef.current = station.slug;
      setPlaybackState(PLAYBACK_STATE.STOPPED);
      // If the browser already allows sound without a gesture (same-origin
      // click navigation, media engagement, per-site permission), start
      // playback as if the visitor pressed play. The probe keeps blocked
      // visitors from loading a stream that could never start.
      canAutoplayAudio().then((allowed) => {
        if (!allowed) return;
        const { playbackState: current } = usePlaybackState.getState();
        // Bail if the visitor beat the probe to it (played, paused, or
        // switched station) — their action wins over the auto-start.
        if (current !== PLAYBACK_STATE.STOPPED) return;
        if (autoSelectedNoLoadRef.current !== station.slug) return;
        setPlaybackState(PLAYBACK_STATE.STARTED);
      });
      return;
    }

    const streamUrl = getStreamUrl(streamType);
    if (!streamUrl) {
      retryMechanism();
      return;
    }

    setPlaybackState(PLAYBACK_STATE.BUFFERING);

    if (isHttpMixedContent(streamUrl)) {
      openHttpStream(streamUrl);
      return;
    }

    if (streamType === STREAM_TYPE.HLS) {
      let cancelled = false;
      let stopNativeWatchdog: (() => void) | null = null;
      getHls().then((Hls) => {
        if (cancelled) return;
        const hls = new Hls(HLS_CONFIG);
        hlsInstanceRef.current = hls;
        cleanupRef.current = loadHLS(streamUrl, audio, hls, Hls);
        if (!Hls.isSupported()) {
          // Native HLS (iOS Safari): hls.js isn't driving the element, so its
          // stuck-detection never runs — use the element-level stall watchdog.
          stopNativeWatchdog = startStallWatchdog(audio);
        }
      });
      return () => {
        cancelled = true;
        stopNativeWatchdog?.();
        destroyCurrentStream();
      };
    }

    audio.src = streamUrl;
    audio.play().catch((error) => handlePlayError(error, `Stream error [${streamType}]`));
    const stopWatchdog = startStallWatchdog(audio);
    return () => {
      stopWatchdog();
      destroyCurrentStream();
    };
  }, [streamType, station.slug, loadKey]);

  const retryMechanism = () => {
    const audio = document.getElementById("audioPlayer") as HTMLAudioElement;
    if (!audio) return;

    // Offline: cycling streams can't possibly succeed — don't burn retries or
    // show the error toast. Keep the spinner and let the 'online' listener
    // restart playback once the connection is back.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      waitingForNetworkRef.current = true;
      setPlaybackState(PLAYBACK_STATE.BUFFERING);
      return;
    }

    retriesRef.current--;
    if (retriesRef.current > 0) {
      const availableStreamTypes = station.station_streams.map(
        (s: IStationStreams) => s.type,
      );
      const streamOrder = [
        STREAM_TYPE.HLS,
        STREAM_TYPE.PROXY,
        STREAM_TYPE.ORIGINAL,
      ];

      const currentIndex = streamType ? streamOrder.indexOf(streamType) : -1;
      let nextIndex = currentIndex;

      do {
        nextIndex = (nextIndex + 1) % streamOrder.length;
        if (availableStreamTypes.includes(streamOrder[nextIndex])) {
          setStreamState({ type: streamOrder[nextIndex], slug: station.slug });
          setHlsActive(streamOrder[nextIndex] === STREAM_TYPE.HLS);
          break;
        }
      } while (nextIndex !== currentIndex);

      if (nextIndex === currentIndex) {
        setStreamState({ type: streamOrder[nextIndex], slug: station.slug });
        setHlsActive(streamOrder[nextIndex] === STREAM_TYPE.HLS);
      }

      // Force a reload even when the chosen type equals the current one —
      // stations with a single stream type would otherwise never actually
      // retry (the loader effect only re-runs when its deps change).
      setLoadKey((k) => k + 1);
    } else {
      setPlaybackState(PLAYBACK_STATE.STOPPED);
      captureException(
        new Error(
          `Hasn't been able to connect to the station - ${station.title}. Tried 20 times :P.`,
        ),
      );
      // Full refresh to pick up potentially updated stream URLs
      refreshStations();
      toast.error(
        <div>
          Nu s-a putut stabili o conexiune cu stația:{" "}
          <strong style={{ fontWeight: "bold" }}>{station.title}</strong>
          <br />
          <br />
          <span style={{ marginTop: 20 }}>
            Vă rugăm să încercați mai târziu!
          </span>
        </div>,
        {
          position: "top-center",
          autoClose: 9000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "light",
        },
      );
    }
  };

  // Keep ref in sync so HLS timeout/error callbacks always call the latest version
  retryMechanismRef.current = retryMechanism;

  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: station.now_playing?.song?.name || station.title,
        artist: station.now_playing?.song?.artist?.name || "",
        artwork: [
          {
            src: getValidImageUrl(station.thumbnail_url),
            sizes: "512x512",
            type: "image/png",
          },
        ],
      });

      navigator.mediaSession.setActionHandler("play", () => {

        setPlaybackState(PLAYBACK_STATE.STARTED);
      });

      navigator.mediaSession.setActionHandler("pause", () => {

        setPlaybackState(PLAYBACK_STATE.STOPPED);
      });

      navigator.mediaSession.setActionHandler("nexttrack", () => {
        nextRandomStation();
      });

      navigator.mediaSession.setActionHandler("previoustrack", () => {
        // In-page playback (category pages) has no station history entries —
        // step back through the list instead of navigating the browser history.
        if (ctx.inPagePlayback) {
          stepStation(-1);
        } else {
          // window. prefix required: the local `history` state (song list) shadows it
          window.history.back();
        }
      });
    }
  }, [station]);

  useSpaceBarPress(() => {
    if (
      playbackState === PLAYBACK_STATE.PLAYING ||
      playbackState === PLAYBACK_STATE.STARTED ||
      playbackState === PLAYBACK_STATE.BUFFERING
    ) {
      setPlaybackState(PLAYBACK_STATE.STOPPED);
      return;
    }

    if (playbackState === PLAYBACK_STATE.STOPPED) {
      setPlaybackState(PLAYBACK_STATE.STARTED);
    }
  });

  const stepStation = (direction: number) => {
    const stationList = ctx.sortedStations || ctx.stations;
    const upStations = stationList.filter(
      (s: any) => s.uptime.is_up === true,
    );
    if (!upStations.length) return;

    const currentIndex = upStations.findIndex((s: any) => s.slug === station.slug);
    const nextIndex =
      (currentIndex + direction + upStations.length) % upStations.length;
    const nextStation = upStations[nextIndex];

    if (nextStation) {
      setCtx({ selectedStation: nextStation });
      if (!ctx.inPagePlayback) {
        window.history.pushState(null, "", `/${nextStation.slug}/`);
      }
    }
  };

  const nextRandomStation = () => stepStation(1);

  // Bare glyphs for the amber play button
  const renderPlayIcon = () => {
    switch (playbackState) {
      case PLAYBACK_STATE.STARTED:
      case PLAYBACK_STATE.BUFFERING:
        return <Loading />;
      case PLAYBACK_STATE.PLAYING:
        return (
          <svg width={22} height={22} viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path fill="currentColor" d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z" />
          </svg>
        );
      default:
        return (
          <svg width={22} height={22} viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path
              fill="currentColor"
              d="M8.2 5.6v12.8a.7.7 0 0 0 1.06.6l10.2-6.4a.7.7 0 0 0 0-1.2L9.26 5a.7.7 0 0 0-1.06.6z"
            />
          </svg>
        );
    }
  };

  return (
    <>
      <div className={styles.player_gradient_overlay} />
      {(expanded || menuOpen) && (
        <div
          className={styles.player_backdrop}
          aria-hidden="true"
          onClick={() => {
            setExpanded(false);
            setMenuOpen(false);
          }}
        />
      )}
      <div className={styles.radio_player_container} ref={playerContainerRef}>
        <div
          className={`${styles.radio_player} ${expanded || menuOpen ? styles.radio_player_open : ""}`}
          onClick={onRowClick}
        >
        {/* Decorative twin of the station_info trigger (which carries the a11y
            semantics) — hidden from AT but tappable (via the card's click
            handler), so the chevron itself closes the menu once it points down */}
        <span
          className={`${styles.player_handle} ${menuOpen ? styles.player_handle_open : ""}`}
          aria-hidden="true"
          data-player-handle
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </span>
        <div
          className={`${styles.player_menu} ${menuOpen ? styles.player_menu_open : ""}`}
          role="menu"
          aria-hidden={!menuOpen}
          aria-label={`Opțiuni ${station.title}`}
          data-menu-ignore
        >
          <div className={styles.menu_clip}>
          <div className={styles.menu_inner}>
            <div className={styles.menu_status}>
              <span
                className={`${styles.menu_live_dot} ${!isStationUp ? styles.menu_live_dot_off : ""}`}
              />
              <span
                className={`${styles.menu_live_label} ${!isStationUp ? styles.menu_live_label_off : ""}`}
              >
                {isStationUp ? "ÎN DIRECT" : "INDISPONIBIL"}
              </span>
              {isStationUp && station.total_listeners > 0 && (
                <span className={styles.menu_listeners}>
                  · {roPlural(station.total_listeners, "ascultător", "ascultători")}{" "}
                  acum
                </span>
              )}
            </div>
            <button
              className={styles.menu_item}
              role="menuitem"
              onClick={() => toggleFavourite(station.slug)}
            >
              <span className={styles.menu_item_icon}>
                <Heart color={isFavorite ? "red" : "white"} defaultColor={"red"} />
              </span>
              <span className={styles.menu_item_label}>
                {isFavorite ? "Elimină de la favorite" : "Adaugă la favorite"}
              </span>
            </button>
            {youtubeSearchUrl && (
              <a
                className={styles.menu_item}
                role="menuitem"
                href={youtubeSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
              >
                <span className={styles.menu_item_icon}>
                  <img src="/icons/youtube.svg" alt="" width={18} height={18} />
                </span>
                <span className={styles.menu_item_text}>
                  <span className={styles.menu_item_label}>
                    Caută melodia pe YouTube
                  </span>
                  <span className={styles.menu_item_sublabel}>{songText}</span>
                </span>
              </a>
            )}
            <button
              className={styles.menu_item}
              role="menuitem"
              onClick={openRecentSongs}
            >
              <span className={styles.menu_item_icon}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </span>
              <span className={styles.menu_item_label}>Melodii redate recent</span>
            </button>
            <button
              className={styles.menu_item}
              role="menuitem"
              onClick={shareStation}
            >
              <span className={styles.menu_item_icon}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </span>
              <span className={styles.menu_item_label}>Distribuie stația</span>
            </button>
            {ctx.inPagePlayback && (
              <a
                className={styles.menu_item}
                role="menuitem"
                href={`/${station.slug}/`}
                onClick={() => setMenuOpen(false)}
              >
                <span className={styles.menu_item_icon}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </span>
                <span className={styles.menu_item_label}>Pagina stației</span>
              </a>
            )}
          </div>
          </div>
        </div>
        {ctx.inPagePlayback && (
          <div
            className={`${styles.expanded_panel} ${expanded ? styles.expanded_panel_open : ""}`}
            aria-hidden={!expanded}
            data-menu-ignore
          >
            <div className={styles.expanded_clip}>
            <div className={styles.expanded_scroll}>
              {station.description && (
                <div>
                  <div className={styles.expanded_row_head}>
                    <p className={styles.expanded_label}>Despre stație</p>
                    {station.total_listeners > 0 && (
                      <span className={styles.expanded_listeners}>
                        {station.total_listeners} <HeadphoneIcon /> acum
                      </span>
                    )}
                  </div>
                  <p className={styles.expanded_description}>{station.description}</p>
                </div>
              )}

              <div>
                <div className={styles.expanded_row_head}>
                  <p className={styles.expanded_label}>Redate recent</p>
                  <a className={styles.expanded_page_link} href={`/${station.slug}/`}>
                    Pagina stației →
                  </a>
                </div>
                {historyLoading && !history?.length ? (
                  <p className={styles.expanded_empty}>Se încarcă istoricul…</p>
                ) : history?.length ? (
                  <div className={styles.expanded_history}>
                    {history.map((item) => (
                      <div
                        className={styles.history_row}
                        key={`${item.timestamp}-${item.song?.id}`}
                      >
                        <img
                          className={styles.history_thumb}
                          src={getValidImageUrl(
                            item.song?.thumbnail_url,
                            getValidImageUrl(station.thumbnail_url),
                          )}
                          alt=""
                          loading="lazy"
                          onError={(e) =>
                            stepImageFallback(e.currentTarget, station.thumbnail_url)
                          }
                        />
                        <span className={styles.history_titles}>
                          <span className={styles.history_song}>{item.song?.name}</span>
                          {item.song?.artist?.name && (
                            <span className={styles.history_artist}>
                              {item.song.artist.name}
                            </span>
                          )}
                          <span className={styles.history_time}>
                            {new Date(item.timestamp).toLocaleTimeString("ro-RO", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.expanded_empty}>
                    Istoricul nu este disponibil pentru această stație.
                  </p>
                )}
              </div>
            </div>
            </div>
          </div>
        )}
        <div className={styles.player_container} data-player-row>
          <div className={styles.image_container}>
            <img
              src={getValidImageUrl(
                station.now_playing?.song?.thumbnail_url || station.thumbnail_url
              )}
              alt={`${station.title} | Radio Crestin`}
              className={styles.station_thumbnail}
              onError={(e) => stepImageFallback(e.currentTarget, station.thumbnail_url)}
            />
          </div>

          <div
            className={styles.station_info}
            role="button"
            tabIndex={0}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Opțiuni ${station.title}`}
            title="Opțiuni stație"
            data-player-info
            onKeyDown={(e) => {
              if (e.repeat) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setMenuOpen((v) => !v);
              }
            }}
          >
            <h2 className={styles.station_title}>{station.title}</h2>
            {station.uptime?.is_up !== false ? (
              <>
                {shownSongText && (
                  <div
                    className={`${styles.song_ticker} ${
                      songAnim === "leave"
                        ? styles.ticker_leave
                        : songAnim === "enter"
                          ? styles.ticker_enter
                          : ""
                    }`}
                    data-marquee={tickerMarquee ? "true" : undefined}
                    ref={tickerRef}
                  >
                    <span
                      className={styles.ticker_inner}
                      style={
                        tickerMarquee
                          ? { animationDuration: `${tickerDuration}s` }
                          : undefined
                      }
                    >
                      {tickerMarquee ? (
                        <>
                          {shownSongText}
                          <span className={styles.ticker_sep} aria-hidden="true">·</span>
                          {shownSongText}
                          <span className={styles.ticker_sep} aria-hidden="true">·</span>
                        </>
                      ) : (
                        shownSongText
                      )}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <OfflineStatus size="small" />
            )}
          </div>

          <div className={styles.volume_slider} data-menu-ignore>
            <input
              type="range"
              min="0"
              max="100"
              value={playerVolume}
              className={styles.slider}
              onChange={(e) => setPlayerVolume(Number(e.target.value))}
              aria-label="Player Volume"
              style={{ '--fill-percent': `${playerVolume}%` } as React.CSSProperties}
            />
          </div>

          <div className={styles.play_button_container}>
            <button
              aria-label={isFavorite ? "Elimină de la favorite" : "Adaugă la favorite"}
              className={styles.heart_ghost}
              onClick={() => toggleFavourite(station.slug)}
            >
              <Heart color={isFavorite ? "red" : "white"} defaultColor={"red"} />
            </button>
            <button
              aria-label="Play"
              className={styles.play_button}
              onClick={() => {
                if (
                  playbackState === PLAYBACK_STATE.PLAYING ||
                  playbackState === PLAYBACK_STATE.STARTED ||
                  playbackState === PLAYBACK_STATE.BUFFERING
                ) {
                  setPlaybackState(PLAYBACK_STATE.STOPPED);
                  return;
                }

                if (playbackState === PLAYBACK_STATE.STOPPED) {
                  setPlaybackState(PLAYBACK_STATE.STARTED);
                }
              }}
            >
              <span className={styles.play_icon} aria-hidden="true">
                {renderPlayIcon()}
              </span>
            </button>
          </div>
        </div>

        <audio
          preload="none"
          id="audioPlayer"
          onPlaying={(e) => {
            if (isDestroyingRef.current) return;
            // Healthy playback: cancel any pending network auto-resume and
            // refill the retry budget so long sessions survive many hiccups.
            waitingForNetworkRef.current = false;
            retriesRef.current = MAX_MEDIA_RETRIES;
            setPlaybackState(PLAYBACK_STATE.PLAYING);
            setHasError(false);
            hlsRecoveryRef.current = 0;
            if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
          }}
          onPlay={(e) => {
            if (isDestroyingRef.current) return;
            setPlaybackState(PLAYBACK_STATE.PLAYING);
            setHasError(false);
          }}
          onPause={(e) => {
            if (isDestroyingRef.current) return;
            if (isPausedRef.current) return; // We initiated the pause via stopLoad — don't re-trigger STOPPED
            // Browser paused the element on its own while the connection is
            // down (iOS does this on network loss). The user didn't stop —
            // keep the interruption resumable instead of flipping to STOPPED.
            if (
              typeof navigator !== "undefined" &&
              navigator.onLine === false &&
              usePlaybackState.getState().playbackState !== PLAYBACK_STATE.STOPPED
            ) {
              waitingForNetworkRef.current = true;
              setPlaybackState(PLAYBACK_STATE.BUFFERING);
              return;
            }
            setPlaybackState(PLAYBACK_STATE.STOPPED);
          }}
          onWaiting={(e) => {
            if (isDestroyingRef.current) return;
            // Stalling while offline = network interruption; flag it so the
            // 'online' listener restarts the stream when the connection returns.
            if (typeof navigator !== "undefined" && navigator.onLine === false) {
              waitingForNetworkRef.current = true;
            }
            setPlaybackState(PLAYBACK_STATE.BUFFERING);
          }}
          onError={(e) => {
            if (isDestroyingRef.current) return;
            setHasError(true);
            const mediaError = (e.target as HTMLAudioElement)?.error;
            captureException(
              new Error(
                `Audio error - station: ${station.title}, code: ${mediaError?.code}, message: ${mediaError?.message || "unknown"}`,
              ),
            );
            retryMechanism();
          }}
        />
      </div>
      </div>
    </>
  );
}
