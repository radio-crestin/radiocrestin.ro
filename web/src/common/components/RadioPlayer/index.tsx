"use client";

import React, { useContext, useEffect, useState } from "react";
import Hls from "hls.js";
import useSpaceBarPress from "@/hooks/useSpaceBarPress";
import { Loading } from "@/icons/Loading";
import { CONSTANTS } from "@/constants/constants";
import styles from "./styles.module.scss";
import { Context } from "@/context/ContextProvider";
import usePlayer from "@/store/usePlayer";
import usePlaybackState from "@/store/usePlaybackState";
import { PLAYBACK_STATE } from "@/models/enum";
import { toast } from "react-toastify";
import Heart from "@/icons/Heart";
import useFavourite from "@/store/useFavourite";
import { Bugsnag } from "@/utils/bugsnag";
import { IStationStreams } from "@/models/Station";
import OfflineStatus from "@/components/OfflineStatus";
import Star from "@/icons/Star";
import usePlayCount from "@/store/usePlayCount";
import { useRefreshStations } from "@/hooks/useUpdateStationsMetadata";

enum STREAM_TYPE {
  HLS = "HLS",
  PROXY = "proxied_stream",
  ORIGINAL = "direct_stream",
}

const MAX_MEDIA_RETRIES = 20;

export default function RadioPlayer() {
  const { ctx, setCtx } = useContext(Context);
  const { playerVolume, setPlayerVolume } = usePlayer();
  const { playbackState, setPlaybackState, setHasError } = usePlaybackState();
  const station = ctx.selectedStation;
  const [retries, setRetries] = useState(MAX_MEDIA_RETRIES);
  const [streamType, setStreamType] = useState<STREAM_TYPE | null>(null);
  const { favouriteItems, toggleFavourite } = useFavourite();
  const { incrementPlayCount } = usePlayCount();
  const { refreshStations } = useRefreshStations();
  const [isFavorite, setIsFavorite] = useState(false);
  const [hlsInstance, setHlsInstance] = useState<Hls | null>(null);

  useEffect(() => {
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

    setStreamType(availableStreamType || null);
  }, [station.slug]);

  useEffect(() => {
    setIsFavorite(favouriteItems.includes(station.slug));
  }, [favouriteItems, station.slug]);

  useEffect(() => {
    const audio = document.getElementById("audioPlayer") as HTMLAudioElement;
    if (!audio) return;
    audio.volume = playerVolume / 100;
  }, [playerVolume]);

  const getStreamUrl = (type: STREAM_TYPE | null) => {
    if (!type) return null;
    const stream = station.station_streams.find(
      (stream: IStationStreams) => stream.type === type,
    );
    if (!stream?.stream_url) return null;

    // Add session tracking (only on client side)
    const url = new URL(stream.stream_url);
    
    if (typeof window !== 'undefined') {
      const uuid = localStorage.getItem('radio-crestin-session-uuid') || crypto.randomUUID();
      localStorage.setItem('radio-crestin-session-uuid', uuid);
      url.searchParams.set('ref', window.location.hostname);
      url.searchParams.set('s', uuid);
    }

    return url.toString();
  };

  const loadHLS = (
    hls_stream_url: string,
    audio: HTMLAudioElement,
    hls: Hls,
  ) => {
    if (Hls.isSupported()) {
      hls.loadSource(hls_stream_url);
      hls.attachMedia(audio);
    } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
      audio.src = hls_stream_url;
    }

    hls.on(Hls.Events.AUDIO_TRACK_LOADING, function () {
      setPlaybackState(PLAYBACK_STATE.BUFFERING);
    });

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setPlaybackState(PLAYBACK_STATE.BUFFERING);
      audio.addEventListener(
        "canplaythrough",
        function () {
          audio.play().catch(() => {
            setPlaybackState(PLAYBACK_STATE.STOPPED);
          });
        },
        { once: true },
      );
    });

    hls.on(Hls.Events.ERROR, function (event, data) {
      if (data.fatal) {
        Bugsnag.notify(
          new Error(
            `HLS Fatal error - station.title: ${
              station.title
            }, error: ${JSON.stringify(
              data,
              null,
              2,
            )} - event: ${JSON.stringify(event, null, 2)}`,
          ),
        );
        retryMechanism();
      }
    });
  };

  const resetAndReloadStream = () => {
    const audio = document.getElementById("audioPlayer") as HTMLAudioElement;
    if (!audio || !streamType) return;

    if (hlsInstance) {
      hlsInstance.destroy();
    }

    const streamUrl = getStreamUrl(streamType);
    if (!streamUrl) {
      retryMechanism();
      return;
    }

    if (streamType === STREAM_TYPE.HLS) {
      const newHls = new Hls();
      setHlsInstance(newHls);
      loadHLS(streamUrl, audio, newHls);
    } else {
      audio.src = streamUrl;
      audio.load();
      audio.play().catch((error) => {
        Bugsnag.notify(
          new Error(
            `Error reloading stream - station.title: ${
              station.title
            }, error: ${JSON.stringify(error, null, 2)}`,
          ),
        );
        retryMechanism();
      });
    }
  };

  useEffect(() => {
    const audio = document.getElementById("audioPlayer") as HTMLAudioElement;
    if (!audio) return;

    switch (playbackState) {
      case PLAYBACK_STATE.STARTED:
        incrementPlayCount(station.slug);
        resetAndReloadStream();
        break;
      case PLAYBACK_STATE.STOPPED:
        audio.pause();
        if (hlsInstance) {
          hlsInstance.stopLoad();
          hlsInstance.detachMedia();
        }
        break;
    }
  }, [playbackState]);

  useEffect(() => {
    const audio = document.getElementById("audioPlayer") as HTMLAudioElement;
    if (!audio) return;
    audio.volume = playerVolume / 100;

    return () => {
      setRetries(20);
    };
  }, [station.slug]);

  useEffect(() => {
    const audio = document.getElementById("audioPlayer") as HTMLAudioElement;
    if (!audio || !streamType) return;

    const streamUrl = getStreamUrl(streamType);
    if (!streamUrl) {
      retryMechanism();
      return;
    }

    const hls = new Hls();
    setHlsInstance(hls);

    switch (streamType) {
      case STREAM_TYPE.HLS:
        loadHLS(streamUrl, audio, hls);
        break;
      case STREAM_TYPE.PROXY:
        audio.src = streamUrl;
        audio.play().catch((error) => {
          Bugsnag.notify(
            new Error(
              `Switching from HLS -> PROXY error:157 - station.title: ${
                station.title
              }, error: ${JSON.stringify(error, null, 2)}`,
            ),
          );
          retryMechanism();
        });
        break;
      case STREAM_TYPE.ORIGINAL:
        audio.src = streamUrl;
        audio.play().catch((error) => {
          Bugsnag.notify(
            new Error(
              `Switching from PROXY to ORIGINAL error:168 - station.title: ${
                station.title
              }, error: ${JSON.stringify(error, null, 2)}`,
            ),
          );
          retryMechanism();
        });
    }

    return () => {
      hls.destroy();
    };
  }, [streamType, station.slug]);

  const retryMechanism = () => {
    const audio = document.getElementById("audioPlayer") as HTMLAudioElement;
    if (!audio) return;

    setRetries(retries - 1);
    if (retries > 0) {
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
          setStreamType(streamOrder[nextIndex]);
          break;
        }
      } while (nextIndex !== currentIndex);

      if (nextIndex === currentIndex) {
        setStreamType(streamOrder[nextIndex]);
      }
    } else {
      Bugsnag.notify(
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

  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: station.now_playing?.song?.name || station.title,
        artist: station.now_playing?.song?.artist?.name || "",
        artwork: [
          {
            src: station.thumbnail_url || CONSTANTS.DEFAULT_COVER,
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
      playbackState === PLAYBACK_STATE.STARTED
    ) {
      setPlaybackState(PLAYBACK_STATE.STOPPED);
      return;
    }

    if (playbackState === PLAYBACK_STATE.STOPPED) {
      setPlaybackState(PLAYBACK_STATE.STARTED);
    }
  });

  const nextRandomStation = () => {
    const upStations = ctx.stations.filter(
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
              src={
                station.now_playing?.song?.thumbnail_url ||
                station.thumbnail_url ||
                CONSTANTS.DEFAULT_COVER
              }
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
                  playbackState === PLAYBACK_STATE.STARTED
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
          preload="true"
          autoPlay
          id="audioPlayer"
          onPlaying={() => {
            setPlaybackState(PLAYBACK_STATE.PLAYING);
            setHasError(false);
          }}
          onPlay={() => {
            setPlaybackState(PLAYBACK_STATE.PLAYING);
            setHasError(false);
          }}
          onPause={() => {
            setPlaybackState(PLAYBACK_STATE.STOPPED);
          }}
          onWaiting={() => {
            setPlaybackState(PLAYBACK_STATE.BUFFERING);
          }}
          onError={(error) => {
            setHasError(true);
            Bugsnag.notify(
              new Error(
                `Audio error:414 - station.title: ${station.title}, error: ${error}`,
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
