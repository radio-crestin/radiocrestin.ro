import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Hls from "hls.js";
import useSpaceBarPress from "@/hooks/useSpaceBarPress";
import { Loading } from "@/icons/Loading";
import { CONSTANTS } from "@/constants/constants";
import styles from "./styles.module.scss";

enum STREAM_TYPE {
  HLS = "HLS",
  PROXY = "PROXY",
  ORIGINAL = "ORIGINAL",
}

enum PLAYBACK_STATE {
  STARTED = "started",
  STOPPED = "stopped",
  BUFFERING = "buffering",
  PLAYING = "playing",
}

const MAX_MEDIA_RETRIES = 20;

export default function RadioPlayer({ stations }: any) {
  // const toast = useToast();
  const router = useRouter();
  const { station_slug } = router.query;
  const [retries, setRetries] = useState(MAX_MEDIA_RETRIES);
  const [playbackState, setPlaybackState] = useState(PLAYBACK_STATE.STOPPED);
  const volume = 20;
  // TODO: Fix it later
  // const [volume, setVolume] = useLocalStorageState(25, "AUDIO_PLAYER_VOLUME");
  const [streamType, setStreamType] = useState(STREAM_TYPE.HLS);

  useEffect(() => {
    const audio = document.getElementById("audioPlayer") as HTMLAudioElement;
    if (!audio) return;
    audio.volume = volume / 100;
  }, [volume]);

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
        retryMechanism();
      }
    });
  };

  useEffect(() => {
    const audio = document.getElementById("audioPlayer") as HTMLAudioElement;
    if (!audio) return;

    switch (playbackState) {
      case PLAYBACK_STATE.STARTED:
        audio.play().catch(() => {
          setPlaybackState(PLAYBACK_STATE.STOPPED);
        });
        break;
      case PLAYBACK_STATE.STOPPED:
        audio.pause();
        break;
    }
  }, [playbackState]);

  const station = stations.find(
    (station: { slug: string }) => station.slug === station_slug,
  );

  if (!station) {
    return <></>;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const audio = document.getElementById("audioPlayer") as HTMLAudioElement;
    if (!audio) return;
    audio.volume = volume / 100;

    return () => {
      setStreamType(STREAM_TYPE.HLS);
      setRetries(20);
    };
  }, [station.slug]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const hls = new Hls();
    const audio = document.getElementById("audioPlayer") as HTMLAudioElement;
    if (!audio) return;

    switch (streamType) {
      case STREAM_TYPE.HLS:
        loadHLS(station.hls_stream_url, audio, hls);
        break;
      case STREAM_TYPE.PROXY:
        audio.src = station.proxy_stream_url;
        audio.play().catch(() => {
          setPlaybackState(PLAYBACK_STATE.STOPPED);
        });
        break;
      case STREAM_TYPE.ORIGINAL:
        audio.src = station.stream_url;
        audio.play().catch(() => {
          setPlaybackState(PLAYBACK_STATE.STOPPED);
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
      switch (streamType) {
        case STREAM_TYPE.HLS:
          setStreamType(STREAM_TYPE.PROXY);
          break;
        case STREAM_TYPE.PROXY:
          setStreamType(STREAM_TYPE.ORIGINAL);
          break;
        case STREAM_TYPE.ORIGINAL:
          setStreamType(STREAM_TYPE.HLS);
          break;
      }
    } else {
      // toast({
      //   title: `Nu s-a putut stabili o conexiune cu stația: ${station.title}`,
      //   description: "Vă rugăm să încercați mai târziu!",
      //   status: "error",
      //   position: "top",
      //   duration: 8000,
      //   isClosable: true,
      // });
    }
  };

  // Mobile/Desktop Navigation Controls
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: station.now_playing?.song?.name || station.title,
        artist: station.now_playing?.song?.artist.name || "",
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

  // eslint-disable-next-line react-hooks/rules-of-hooks
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
    const upStations = stations.filter(
      (station: any) => station.uptime.is_up === true,
    );

    // Find the index of the current ID
    const currentIndex = upStations.findIndex((s: any) => s.id === station.id);

    // Increment the index to move to the next ID
    const nextIndex = currentIndex + 1;
    const nextStation = upStations[nextIndex % upStations.length];

    router.push(`/${nextStation.slug}`);
  };

  const renderPlayButtonSvg = () => {
    switch (playbackState) {
      case PLAYBACK_STATE.STARTED:
        return <Loading />;
      case PLAYBACK_STATE.BUFFERING:
        return <Loading />;
      case PLAYBACK_STATE.PLAYING:
        return (
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
        );
      default:
        return (
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM9.5 16.5v-9l7 4.5-7 4.5z" />
        );
    }
  };

  return (
    <div className={styles.radio_player}>
      <div className={styles.player_container}>
        <img
          src={
            station.now_playing?.song?.thumbnail_url ||
            station.thumbnail_url ||
            CONSTANTS.DEFAULT_COVER
          }
          alt={`${station.title} | Radio Crestin`}
          className={styles.station_thumbnail}
        />

        <div className={styles.station_info}>
          <h2 className={styles.station_title}>
            {station.now_playing?.song?.name || station.title}
          </h2>
          <p className={styles.station_artist}>
            {station.now_playing?.song?.artist.name}
          </p>
        </div>

        <div className={styles.volume_slider}>
          <input
            type="range"
            min="1"
            max="100"
            value={volume}
            className={styles.slider}
            // onChange={(e) => setVolume(Number(e.target.value))}
          />
        </div>

        <div className={styles.play_button_container}>
          <button
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
        }}
        onPlay={() => {
          setPlaybackState(PLAYBACK_STATE.PLAYING);
        }}
        onPause={() => {
          setPlaybackState(PLAYBACK_STATE.STOPPED);
        }}
        onWaiting={() => {
          setPlaybackState(PLAYBACK_STATE.BUFFERING);
        }}
        onError={() => {
          retryMechanism();
        }}
      />
    </div>
  );
}
