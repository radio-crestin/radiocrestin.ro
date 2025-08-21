"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import Hls from "hls.js";
import { Loading } from "@/icons/Loading";
import { CONSTANTS } from "@/common/constants/constants";
import styles from "./styles.module.scss";
import usePlayer from "@/common/store/usePlayer";
import { PLAYBACK_STATE } from "@/common/models/enum";
import Heart from "@/icons/Heart";
import useFavourite from "@/common/store/useFavourite";
import { IStationStreams, IStationExtended } from "@/common/models/Station";
import { useSelectedStation } from "@/common/providers/SelectedStationProvider";

interface RadioPlayerProps {
  initialStation: IStationExtended | null;
}

export default function RadioPlayer({ initialStation }: RadioPlayerProps) {
  const { playerVolume, setPlayerVolume } = usePlayer();
  const [playbackState, setPlaybackState] = useState(PLAYBACK_STATE.STOPPED);
  const [currentStreamIndex, setCurrentStreamIndex] = useState(0);
  const { favouriteItems, toggleFavourite } = useFavourite();
  const [isFavorite, setIsFavorite] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const hlsRef = useRef<Hls | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isLoadingRef = useRef(false);
  const shouldPlayRef = useRef(false);
  const currentUrlRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);

  // Use context station or fall back to initial
  const { selectedStation: contextStation } = useSelectedStation();
  const activeStation = contextStation || initialStation;
  const prevStationId = useRef<number | null>(null);

  // Get sorted streams by order
  const sortedStreams = useMemo(() => {
    if (!activeStation?.station_streams) return [];
    const sorted = [...activeStation.station_streams].sort((a, b) =>
      (b.order || 999) - (a.order || 999)
    );
    console.log('[RadioPlayer] Sorted streams:', sorted.map(s => ({
      type: s.type,
      order: s.order,
      url: s.stream_url
    })));
    return sorted;
  }, [activeStation?.station_streams]);

  // Current stream URL with session tracking
  const currentStreamUrl = useMemo(() => {
    if (!sortedStreams[currentStreamIndex]) return null;

    const stream = sortedStreams[currentStreamIndex];
    if (!stream.stream_url) return null;

    // Add session tracking (only on client side)
    const url = new URL(stream.stream_url);

    if (typeof window !== 'undefined') {
      const uuid = localStorage.getItem('radio-crestin-session-uuid') || crypto.randomUUID();
      localStorage.setItem('radio-crestin-session-uuid', uuid);
      url.searchParams.set('ref', window.location.hostname);
      url.searchParams.set('s', uuid);
    }

    return url.toString();
  }, [sortedStreams, currentStreamIndex]);

  // Check if current stream is HLS
  const isHLS = useMemo(() => {
    return sortedStreams[currentStreamIndex]?.type === 'HLS';
  }, [sortedStreams, currentStreamIndex]);

  // Update favorite status
  useEffect(() => {
    if (!activeStation) return;
    setIsFavorite(favouriteItems.includes(activeStation.slug));
  }, [favouriteItems, activeStation]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = playerVolume / 100;
    }
  }, [playerVolume]);

  // Handle station changes and autoplay
  useEffect(() => {
    if (activeStation?.id && activeStation.id !== prevStationId.current) {
      console.log('[RadioPlayer] Station update - current:', activeStation.title, 'prev:', prevStationId.current);
      
      const isInitialLoad = prevStationId.current === null;
      const hasStationInPath = typeof window !== 'undefined' && 
                              window.location.pathname !== '/' && 
                              window.location.pathname.length > 1;
      
      console.log('[RadioPlayer] isInitialLoad:', isInitialLoad, 'hasStationInPath:', hasStationInPath, 'path:', typeof window !== 'undefined' ? window.location.pathname : 'SSR');
      
      setCurrentStreamIndex(0);
      isLoadingRef.current = false;
      currentUrlRef.current = null;
      retryCountRef.current = 0;
      setAutoplayBlocked(false);
      
      // Try autoplay on station pages or when changing stations
      if ((isInitialLoad && hasStationInPath) || !isInitialLoad) {
        console.log('[RadioPlayer] Starting autoplay');
        setPlaybackState(PLAYBACK_STATE.STARTED);
      }
      
      prevStationId.current = activeStation.id;
    }
  }, [activeStation?.id, activeStation?.title]);

  // Try next stream in the list
  const tryNextStream = React.useCallback(() => {
    console.log('[RadioPlayer] tryNextStream called', {
      currentStreamIndex,
      totalStreams: sortedStreams.length,
      hasMoreStreams: currentStreamIndex < sortedStreams.length - 1
    });

    if (currentStreamIndex < sortedStreams.length - 1) {
      console.log('[RadioPlayer] Moving to next stream index:', currentStreamIndex + 1);
      setCurrentStreamIndex(prev => prev + 1);
    } else {
      console.log('[RadioPlayer] No more streams to try, stopping playback');
      // All streams failed
      setPlaybackState(PLAYBACK_STATE.STOPPED);
    }
  }, [currentStreamIndex, sortedStreams.length, setPlaybackState]);

  // Handle stream loading - only when stream URL changes
  useEffect(() => {
    const audio = audioRef.current;
    console.log('[RadioPlayer] Stream loading effect triggered', {
      hasAudio: !!audio,
      currentStreamUrl,
      currentStreamIndex,
      isLoading: isLoadingRef.current
    });

    if (!audio || !currentStreamUrl) return;

    // Skip if we're already loading
    if (isLoadingRef.current) {
      console.log('[RadioPlayer] Already loading, skipping...');
      return;
    }

    // Skip if we've already loaded this exact URL
    if (currentUrlRef.current === currentStreamUrl) {
      console.log('[RadioPlayer] Stream already loaded with this URL, skipping...');
      return;
    }

    // Update the current URL ref
    currentUrlRef.current = currentStreamUrl;

    // Clean up previous HLS instance
    if (hlsRef.current) {
      console.log('[RadioPlayer] Cleaning up previous HLS instance');
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Mark as loading
    isLoadingRef.current = true;

    if (isHLS && Hls.isSupported()) {
      console.log('[RadioPlayer] Loading HLS stream:', currentStreamUrl);
      // Use HLS.js for HLS streams with optimized configuration
      const hls = new Hls({
        // Enable adaptive bitrate switching
        enableWorker: true,
        // Reduce fragment loading retries to prevent excessive requests
        fragLoadingTimeOut: 10000,
        fragLoadingMaxRetry: 3,
        fragLoadingRetryDelay: 1000,
        fragLoadingMaxRetryTimeout: 32000,
        // Manifest loading configuration
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 3,
        manifestLoadingRetryDelay: 1000,
        manifestLoadingMaxRetryTimeout: 32000,
        // Level loading configuration
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 3,
        levelLoadingRetryDelay: 1000,
        levelLoadingMaxRetryTimeout: 32000,
        // Start from the live edge
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        // Enable low latency mode if supported
        lowLatencyMode: true,
        // Skip problematic fragments instead of failing
        testBandwidth: false,
        debug: false
      });
      hlsRef.current = hls;

      hls.loadSource(currentStreamUrl);
      hls.attachMedia(audio);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[RadioPlayer] HLS manifest parsed, stream ready');
        isLoadingRef.current = false;
        // If playback should be started, play the new stream
        if (shouldPlayRef.current) {
          audio.play().then(() => {
            console.log('[RadioPlayer] HLS playback started successfully');
            setAutoplayBlocked(false);
          }).catch((error) => {
            console.error('[RadioPlayer] HLS play error:', error);
            if (error.name === 'NotAllowedError') {
              setAutoplayBlocked(true);
            }
            shouldPlayRef.current = false;
            setPlaybackState(PLAYBACK_STATE.STOPPED);
          });
        }
      });

      // Fragment error handling is already done in the ERROR event handler below
      // HLS.js automatically skips problematic fragments

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('[RadioPlayer] HLS error:', data);
        
        // Handle fragment parsing errors specifically
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && 
            data.details === Hls.ErrorDetails.FRAG_PARSING_ERROR) {
          console.log('[RadioPlayer] Fragment parsing error detected, attempting recovery');
          
          // Don't mark as fatal, let HLS.js handle recovery
          // The library will automatically skip the problematic fragment
          // and continue with the next one from the refreshed manifest
          return;
        }
        
        // Handle other non-fatal errors
        if (!data.fatal) {
          console.log('[RadioPlayer] Non-fatal HLS error, continuing playback');
          return;
        }
        
        // Handle fatal errors
        console.log('[RadioPlayer] Fatal HLS error detected');
        
        // For network errors on fragments, try to recover
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          console.log('[RadioPlayer] Network error, attempting recovery');
          
          switch (data.details) {
            case Hls.ErrorDetails.MANIFEST_LOAD_ERROR:
            case Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT:
            case Hls.ErrorDetails.MANIFEST_PARSING_ERROR:
              // Manifest errors are truly fatal, try next stream
              console.log('[RadioPlayer] Manifest error, trying next stream');
              isLoadingRef.current = false;
              tryNextStream();
              break;
              
            case Hls.ErrorDetails.FRAG_LOAD_ERROR:
            case Hls.ErrorDetails.FRAG_LOAD_TIMEOUT:
              // Fragment errors might be temporary
              console.log('[RadioPlayer] Fragment load error, HLS.js will retry');
              // Let HLS.js handle the retry with exponential backoff
              break;
              
            default:
              // For other network errors, try recovery first
              console.log('[RadioPlayer] Attempting HLS recovery');
              hls.startLoad();
              break;
          }
        } else {
          // For other fatal errors, try next stream
          console.log('[RadioPlayer] Unrecoverable error, trying next stream');
          isLoadingRef.current = false;
          tryNextStream();
        }
      });
    } else {
      console.log('[RadioPlayer] Loading direct stream:', currentStreamUrl);
      // Direct stream playback
      audio.src = currentStreamUrl;
      isLoadingRef.current = false;
      
      // If playback should be started, play the new stream
      if (shouldPlayRef.current) {
        // Give the audio element time to load the new source
        audio.load();
        audio.play().then(() => {
          console.log('[RadioPlayer] Direct stream playback started after fallback');
          setAutoplayBlocked(false);
        }).catch((error) => {
          console.error('[RadioPlayer] Direct stream play error:', error);
          if (error.name === 'NotAllowedError') {
            setAutoplayBlocked(true);
            setPlaybackState(PLAYBACK_STATE.STOPPED);
            shouldPlayRef.current = false;
          } else {
            tryNextStream();
          }
        });
      }
    }

    return () => {
      console.log('[RadioPlayer] Cleanup function called');
      isLoadingRef.current = false;
      // Only clean up HLS if the URL has changed
      if (currentUrlRef.current !== currentStreamUrl && hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStreamUrl, currentStreamIndex]);

  // Handle play/pause based on playback state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playbackState === PLAYBACK_STATE.STARTED) {
      console.log('[RadioPlayer] Playback started, setting shouldPlay to true');
      shouldPlayRef.current = true;
      
      // If stream is already loaded and not loading, play it
      if (audio.src && !isLoadingRef.current) {
        audio.play().then(() => {
          console.log('[RadioPlayer] Playback resumed successfully');
          setAutoplayBlocked(false);
        }).catch((error) => {
          console.error('[RadioPlayer] Play error:', error);
          if (error.name === 'NotAllowedError') {
            setAutoplayBlocked(true);
            shouldPlayRef.current = false;
          }
          setPlaybackState(PLAYBACK_STATE.STOPPED);
        });
      }
    } else if (playbackState === PLAYBACK_STATE.STOPPED) {
      console.log('[RadioPlayer] Stopping playback');
      shouldPlayRef.current = false;
      audio.pause();
    }
  }, [playbackState]);

  // Update media session
  useEffect(() => {
    if ("mediaSession" in navigator && activeStation) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: activeStation.now_playing?.song?.name || activeStation.title,
        artist: activeStation.now_playing?.song?.artist?.name || "",
        artwork: [{
          src: activeStation.thumbnail_url || CONSTANTS.DEFAULT_COVER,
          sizes: "512x512",
          type: "image/png",
        }],
      });
    }
  }, [activeStation]);

  const togglePlayback = () => {
    console.log('[RadioPlayer] togglePlayback called, current state:', playbackState);
    setAutoplayBlocked(false);
    setPlaybackState(playbackState === PLAYBACK_STATE.PLAYING ? PLAYBACK_STATE.STOPPED : PLAYBACK_STATE.STARTED);
  };

  const renderPlayButton = () => {
    if (autoplayBlocked) {
      return <path fill="white" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM9.5 16.5v-9l7 4.5-7 4.5z" />;
    }
    if (playbackState === PLAYBACK_STATE.BUFFERING || playbackState === PLAYBACK_STATE.STARTED) {
      return <Loading />;
    }
    if (playbackState === PLAYBACK_STATE.PLAYING) {
      return <path fill="white" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />;
    }
    return <path fill="white" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM9.5 16.5v-9l7 4.5-7 4.5z" />;
  };

  if (!activeStation) return null;

  return (
    <div className={styles.radio_player_container}>
      <div className={styles.radio_player}>
        <div className={styles.player_container}>
          {/* Album art with favorite button */}
          <div className={styles.image_container}>
            <img
              src={activeStation.now_playing?.song?.thumbnail_url ||
                   activeStation.thumbnail_url ||
                   CONSTANTS.DEFAULT_COVER}
              alt={`${activeStation.title} | Radio Crestin`}
              className={styles.station_thumbnail}
            />
            <div
              className={styles.heart_container}
              onClick={() => toggleFavourite(activeStation.slug)}
            >
              <Heart color={isFavorite ? "red" : "white"} defaultColor="red" />
            </div>
          </div>

          {/* Station info and metadata */}
          <div className={`${styles.station_info} ${styles.two_lines}`}>
            <h2 className={styles.station_title}>{activeStation.title}</h2>
            <p className={styles.song_name}>
              {activeStation.now_playing?.song?.name}
              {activeStation.now_playing?.song?.artist?.name && (
                <span className={styles.artist_name}>
                  {" · "}
                  {activeStation.now_playing?.song?.artist?.name}
                </span>
              )}
            </p>
          </div>

          {/* Volume control */}
          <div className={styles.volume_slider}>
            <input
              type="range"
              min="0"
              max="100"
              value={playerVolume}
              className={styles.slider}
              onChange={(e) => setPlayerVolume(Number(e.target.value))}
              aria-label="Player Volume"
            />
          </div>

          {/* Play/pause button */}
          <div className={styles.play_button_container}>
            <button
              aria-label="Play"
              className={styles.play_button}
              onClick={togglePlayback}
            >
              <svg width="50px" height="50px" viewBox="0 0 24 24">
                {renderPlayButton()}
              </svg>
            </button>
          </div>
        </div>

        {/* Audio element */}
        <audio
          ref={audioRef}
          onPlaying={() => {
            console.log('[RadioPlayer] Audio onPlaying event, isLoading:', isLoadingRef.current);
            if (!isLoadingRef.current) {
              setPlaybackState(PLAYBACK_STATE.PLAYING);
            }
          }}
          onPlay={() => {
            console.log('[RadioPlayer] Audio onPlay event, isLoading:', isLoadingRef.current);
            if (!isLoadingRef.current) {
              setPlaybackState(PLAYBACK_STATE.PLAYING);
            }
          }}
          onPause={() => {
            console.log('[RadioPlayer] Audio onPause event');
            setPlaybackState(PLAYBACK_STATE.STOPPED);
          }}
          onWaiting={() => {
            console.log('[RadioPlayer] Audio onWaiting event');
            setPlaybackState(PLAYBACK_STATE.BUFFERING);
          }}
          onError={(e) => {
            const audio = e.currentTarget;
            console.error('[RadioPlayer] Audio onError event', {
              error: audio.error,
              errorCode: audio.error?.code,
              errorMessage: audio.error?.message,
              currentSrc: audio.currentSrc,
              readyState: audio.readyState,
              networkState: audio.networkState
            });
            // Only try next stream for actual network/decode errors, not permission errors
            if (!isLoadingRef.current && audio.error?.code !== 4) { // 4 = MEDIA_ERR_SRC_NOT_SUPPORTED (includes autoplay)
              tryNextStream();
            }
          }}
        />
      </div>
    </div>
  );
}
