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
import { Loading } from "@/icons/Loading";
import { CONSTANTS } from "@/constants/constants";
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
import Star from "@/icons/Star";
import usePlayCount from "@/store/usePlayCount";
import { useRefreshStations } from "@/hooks/useUpdateStationsMetadata";
import { getValidImageUrl } from "@/utils";

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
  const hlsInstanceRef = useRef<HlsType | null>(null);
  const isPausedRef = useRef(false); // true = HLS paused with stopLoad(), resumable
  const retryMechanismRef = useRef<() => void>(() => {});
  const hlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hlsRecoveryRef = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);
  const isDestroyingRef = useRef(false);
  const [loadKey, setLoadKey] = useState(0);
  const prevLoadKeyRef = useRef(0);
  const listeningStartRef = useRef<{ time: number; slug: string; title: string; id: number } | null>(null);

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
    // Ignore errors from intentional cancellation (station switch or user pause)
    if (error.name === 'AbortError' || isDestroyingRef.current) return;
    if (error.name === 'NotAllowedError') {
      setPlaybackState(PLAYBACK_STATE.STOPPED);
      return;
    }
    captureException(error, `${context} - station: ${station.title}`);
    retryMechanism();
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
    };
  }, [station.slug]);

  useEffect(() => {
    setIsFavorite(favouriteItems.includes(station.slug));
  }, [favouriteItems, station.slug]);

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

    // Track the actual playback timestamp from EXT-X-PROGRAM-DATE-TIME.
    // This is the authoritative source for "what time is the audio I'm hearing?"
    // and is used by the metadata hook to fetch the matching song info.
    hls.on(Hls.Events.FRAG_CHANGED, (_event, data) => {
      if (hls !== hlsInstanceRef.current) return;
      const pdt = data.frag.programDateTime;
      if (pdt) {
        // pdt is milliseconds since epoch — convert to 10s-aligned Unix seconds
        const epochSec = Math.floor(pdt / 10000) * 10;
        setHlsPlaybackTimestamp(epochSec);
      }
    });

    // ID3 metadata from HLS segments — detect song changes for immediate refresh.
    // The backend injects TXXX frames with "song_id\0<id>" into every .ts segment.
    hls.on(Hls.Events.FRAG_PARSING_METADATA, (_event, data) => {
      if (hls !== hlsInstanceRef.current) return;
      for (const sample of data.samples) {
        try {
          // hls.js decodes ID3 frames — each sample.data is a Uint8Array with
          // the full ID3 tag. We scan for TXXX frames containing "song_id".
          const text = new TextDecoder("utf-8", { fatal: false }).decode(sample.data);
          const match = text.match(/song_id\0(\d+)/);
          if (match) {
            const songId = parseInt(match[1], 10);
            if (!isNaN(songId)) {
              setHlsSongId(songId);
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

  // Stream loader effect — single owner of HLS lifecycle
  useEffect(() => {
    const loadKeyChanged = loadKey !== prevLoadKeyRef.current;
    prevLoadKeyRef.current = loadKey;

    const audio = document.getElementById("audioPlayer") as HTMLAudioElement;
    if (!audio || !streamType) return;

    // If this re-run was triggered by loadKey (resume) but user already stopped
    // (e.g. clicked play then immediately paused — React batches both), bail out.
    if (loadKeyChanged && playbackState === PLAYBACK_STATE.STOPPED) return;

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
      getHls().then((Hls) => {
        if (cancelled) return;
        const hls = new Hls(HLS_CONFIG);
        hlsInstanceRef.current = hls;
        cleanupRef.current = loadHLS(streamUrl, audio, hls, Hls);
      });
      return () => { cancelled = true; destroyCurrentStream(); };
    } else {
      audio.src = streamUrl;
      audio.play().catch((error) => handlePlayError(error, `Stream error [${streamType}]`));
    }

    return () => {
      destroyCurrentStream();
    };
  }, [streamType, station.slug, loadKey]);

  const retryMechanism = () => {
    const audio = document.getElementById("audioPlayer") as HTMLAudioElement;
    if (!audio) return;

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
        history.back();
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

  const nextRandomStation = () => {
    const stationList = ctx.sortedStations || ctx.stations;
    const upStations = stationList.filter(
      (s: any) => s.uptime.is_up === true,
    );

    const currentIndex = upStations.findIndex((s: any) => s.slug === station.slug);
    const nextIndex = (currentIndex + 1) % upStations.length;
    const nextStation = upStations[nextIndex];

    if (nextStation) {
      setCtx({ selectedStation: nextStation });
      window.history.pushState(null, "", `/${nextStation.slug}`);
    }
  };

  const renderPlayButtonSvg = () => {
    switch (playbackState) {
      case PLAYBACK_STATE.STARTED:
        return <Loading />;
      case PLAYBACK_STATE.BUFFERING:
        return <Loading />;
      case PLAYBACK_STATE.PLAYING:
        return (
          <path
            fill="white"
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"
          />
        );
      default:
        return (
          <path
            fill="white"
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM9.5 16.5v-9l7 4.5-7 4.5z"
          />
        );
    }
  };

  return (
    <>
      <div className={styles.player_gradient_overlay} />
      <div className={styles.radio_player_container}>
        <div className={styles.radio_player}>
        <div className={styles.player_container}>
          <div className={styles.image_container}>
            <img
              src={getValidImageUrl(
                station.now_playing?.song?.thumbnail_url || station.thumbnail_url
              )}
              alt={`${station.title} | Radio Crestin`}
              className={styles.station_thumbnail}
              onError={(e) => {
                e.currentTarget.src = '/images/radio-white-default.jpg';
              }}
            />
            <div
              className={styles.heart_container}
              onClick={() => toggleFavourite(station.slug)}
            >
              <Heart
                color={isFavorite ? "red" : "white"}
                defaultColor={"red"}
              />
            </div>
          </div>

          <div className={`${styles.station_info} ${styles.two_lines}`}>
            <h2 className={styles.station_title}>{station.title}</h2>
            {station.uptime?.is_up !== false ? (
              <p className={styles.song_name}>
                {station?.now_playing?.song?.name}
                {station?.now_playing?.song?.artist?.name && (
                  <span className={styles.artist_name}>
                    {" · "}
                    {station?.now_playing?.song?.artist?.name}
                  </span>
                )}
              </p>
            ) : (
              <OfflineStatus size="small" />
            )}
            {station.reviews_stats?.average_rating > 0 && (
              <div className={styles.average_rating}>
                <Star fillWidth={1} height={10} />
                {station.reviews_stats.average_rating.toFixed(1)}
                <span className={styles.review_count}>
                  ({station.reviews_stats.number_of_reviews} {station.reviews_stats.number_of_reviews === 1 ? 'recenzie' : 'recenzii'})
                </span>
              </div>
            )}
          </div>

          <div className={styles.volume_slider}>
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
              <svg
                width="50px"
                height="50px"
                focusable="false"
                aria-hidden="true"
                viewBox="0 0 24 24"
              >
                {renderPlayButtonSvg()}
              </svg>
            </button>
          </div>
        </div>

        <audio
          preload="none"
          id="audioPlayer"
          onPlaying={(e) => {
            if (isDestroyingRef.current) return;
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
            setPlaybackState(PLAYBACK_STATE.STOPPED);
          }}
          onWaiting={(e) => {
            if (isDestroyingRef.current) return;
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
