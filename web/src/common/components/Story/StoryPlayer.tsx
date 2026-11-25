// The stories player, like Instagram's: progress bars that fill as each slide plays, a slide
// shown only once its media has loaded (the next one loads meanwhile), tap the left third to go
// back and the rest to go on, swipe left / right, press and hold to play at double speed, a
// pause and a sound button, and like and share. Arrow keys and Space work on a keyboard.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { sendStoryEvents, type StoryEvent } from "@/services/stories";
import { getUserId } from "@/utils/posthog";
import { shareLink } from "@/components/Announcements/share";
import type { StoryMedia, StorySlideView, StoryView } from "@/utils/stories";
import styles from "./StoryPlayer.module.scss";

export const HOLD_MS = 220;
export const FAST_RATE = 2;
/** The CTA comes in after this much of the slide has played (sooner on a short slide, so it shows at least CTA_MIN_SHOWN_MS). */
export const CTA_DELAY_MS = 4000;
const CTA_MIN_SHOWN_MS = 1500;
const SWIPE_PX = 50;
const LOAD_TIMEOUT_MS = 10_000;
const LIKES_KEY = "stories-liked";

const report = (events: StoryEvent[]) => sendStoryEvents(events, getUserId());

const readLiked = (): string[] => {
  try {
    const value = JSON.parse(localStorage.getItem(LIKES_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
};

/** This device's like (kept locally, sent as like / unlike events) and the story's count. */
export function useStoryLike(story: StoryView) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(story.likeCount);
  useEffect(() => {
    setLiked(readLiked().includes(story.slug));
    setCount(story.likeCount);
  }, [story.slug, story.likeCount]);

  const toggle = useCallback(async () => {
    const next = !liked;
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    const others = readLiked().filter((s) => s !== story.slug);
    localStorage.setItem(LIKES_KEY, JSON.stringify(next ? [...others, story.slug] : others));
    const answer = await report([{ type: next ? "like" : "unlike", story: story.slug }]);
    const fresh = answer?.like_counts?.[story.slug];
    if (typeof fresh === "number") setCount(fresh);
  }, [liked, story.slug]);

  return { liked, count, toggle };
}

const formatCount = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".0", "")}M` : n >= 10_000 ? `${Math.round(n / 1000)}K` : String(n);

export default function StoryPlayer({ story }: { story: StoryView }) {
  const slides = story.slides;
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const [paused, setPaused] = useState(false);
  const [fast, setFast] = useState(false);
  const [muted, setMuted] = useState(true);
  const [ended, setEnded] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [ctaShown, setCtaShown] = useState(false);
  const ctaShownRef = useRef(false);
  const { liked, count: likes, toggle: toggleLike } = useStoryLike(story);

  const barRef = useRef<HTMLSpanElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const elapsed = useRef(0);
  const slide = slides[Math.min(index, count - 1)];
  const ready = !!loaded[index];
  const running = ready && !paused && !ended && !embedOpen && !hidden;

  const markLoaded = useCallback((i: number) => setLoaded((l) => (l[i] ? l : { ...l, [i]: true })), []);

  const setBar = (fraction: number) => {
    if (barRef.current) barRef.current.style.transform = `scaleX(${Math.min(1, Math.max(0, fraction))})`;
  };

  const go = useCallback(
    (to: number) => {
      if (to < 0) {
        // Back on the first slide: play it again.
        elapsed.current = 0;
        ctaShownRef.current = false;
        setCtaShown(false);
        setBar(0);
        if (videoRef.current) videoRef.current.currentTime = 0;
        return;
      }
      if (to >= count) {
        setEnded(true);
        setBar(1);
        void report([{ type: "complete", story: story.slug }]);
        return;
      }
      setEnded(false);
      setEmbedOpen(false);
      setIndex(to);
    },
    [count, story.slug],
  );

  // A new story: from the start, and one "view".
  useEffect(() => {
    setIndex(0);
    setEnded(false);
    void report([{ type: "view", story: story.slug }]);
  }, [story.slug]);

  // Each slide: progress from zero, a "slide_view", and a fallback if its media never loads.
  useEffect(() => {
    elapsed.current = 0;
    setBar(0);
    ctaShownRef.current = false;
    setCtaShown(false);
    void report([{ type: "slide_view", story: story.slug, slide: slide.id }]);
    const timer = window.setTimeout(() => markLoaded(index), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [index, story.slug, slide.id, markLoaded]);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // The clock: a video's own time, else the slide's duration (twice as fast while held).
  useEffect(() => {
    const video = slide.media.kind === "video" ? videoRef.current : null;
    if (video) {
      video.playbackRate = fast ? FAST_RATE : 1;
      video.muted = muted;
      if (running) {
        video.play().catch(() => {
          // Autoplay with sound refused: play muted.
          video.muted = true;
          setMuted(true);
          video.play().catch(() => {});
        });
      } else {
        video.pause();
      }
    }
    if (!running) return;
    let last = performance.now();
    let frame = 0;
    const showCtaAfter = (playedMs: number, totalMs: number) => {
      if (!ctaShownRef.current && slide.cta && playedMs >= Math.max(0, Math.min(CTA_DELAY_MS, totalMs - CTA_MIN_SHOWN_MS))) {
        ctaShownRef.current = true;
        setCtaShown(true);
      }
    };
    const tick = (now: number) => {
      if (video) {
        if (video.duration > 0) {
          setBar(video.currentTime / video.duration);
          showCtaAfter(video.currentTime * 1000, video.duration * 1000);
        }
      } else {
        showCtaAfter(elapsed.current, slide.duration * 1000);
        elapsed.current += (now - last) * (fast ? FAST_RATE : 1);
        const fraction = elapsed.current / (slide.duration * 1000);
        setBar(fraction);
        if (fraction >= 1) {
          go(index + 1);
          return;
        }
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, fast, muted, index, slide, go]);

  // Keyboard: ← → to move, Space to pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea")) return;
      if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  // Gestures: tap (left third back, else on), swipe left / right, press and hold for double speed.
  const gesture = useRef<{ x: number; y: number; id: number; holdTimer: number; held: boolean; swiping: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a, iframe, video[controls]") || e.button > 0) return;
    const holdTimer = window.setTimeout(() => {
      if (gesture.current) {
        gesture.current.held = true;
        setFast(true);
      }
    }, HOLD_MS);
    gesture.current = { x: e.clientX, y: e.clientY, id: e.pointerId, holdTimer, held: false, swiping: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId || g.held) return;
    const dx = e.clientX - g.x;
    if (!g.swiping && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(e.clientY - g.y)) {
      g.swiping = true;
      window.clearTimeout(g.holdTimer);
    }
    if (g.swiping && stageRef.current) stageRef.current.style.transform = `translateX(${dx * 0.6}px)`;
  };
  const endGesture = (e: React.PointerEvent, cancelled = false) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    window.clearTimeout(g.holdTimer);
    if (stageRef.current) stageRef.current.style.transform = "";
    if (g.held) {
      setFast(false);
      return;
    }
    if (cancelled) return;
    const dx = e.clientX - g.x;
    if (g.swiping) {
      if (dx <= -SWIPE_PX) go(index + 1);
      else if (dx >= SWIPE_PX) go(index - 1);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    go(e.clientX - rect.left < rect.width / 3 ? index - 1 : index + 1);
  };

  const restart = () => {
    setEnded(false);
    if (index === 0) {
      elapsed.current = 0;
      setBar(0);
      if (videoRef.current) videoRef.current.currentTime = 0;
    } else setIndex(0);
  };

  const share = () => {
    void shareLink(story.shareUrl, `${story.title} — Radio Creștin`);
    void report([{ type: "share", story: story.slug }]);
  };

  // The slides on stage: this one, the next (loading meanwhile) and the previous (instant back).
  const mounted = [index - 1, index, index + 1].filter((i) => i >= 0 && i < count);

  return (
    <div className={styles.wrap}>
      {index > 0 && (
        <button type="button" className={`${styles.side} ${styles.sidePrev}`} aria-label="Înapoi" onClick={() => go(index - 1)}>
          <Chevron left />
        </button>
      )}
      <div
        className={styles.player}
        data-testid="story-player"
        data-index={index}
        data-ready={ready ? "1" : "0"}
        data-fast={fast ? "1" : "0"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endGesture(e)}
        onPointerCancel={(e) => endGesture(e, true)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className={styles.stage} ref={stageRef}>
          {mounted.map((i) => (
            <SlideLayer
              key={`${slides[i].id}-${i}`}
              slide={slides[i]}
              active={i === index}
              onLoaded={() => markLoaded(i)}
              videoRef={i === index ? videoRef : undefined}
              onVideoEnded={() => go(index + 1)}
              onEmbedOpen={() => setEmbedOpen(true)}
            />
          ))}
        </div>

        {!ready && (
          <div className={styles.loading} role="status" aria-label="Se încarcă">
            <span className={styles.spinner} />
          </div>
        )}

        <div className={styles.top}>
          <div className={styles.bars} role="tablist" aria-label="Diapozitive">
            {slides.map((s, i) => (
              <button
                key={`${s.id}-${i}`}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Diapozitivul ${i + 1} din ${count}`}
                className={styles.bar}
                onClick={() => go(i)}
              >
                <span
                  ref={i === index ? barRef : undefined}
                  className={styles.fill}
                  style={{ transform: `scaleX(${i < index || (ended && i === index) ? 1 : 0})` }}
                />
              </button>
            ))}
          </div>
          <div className={styles.head}>
            {story.cover ? <img className={styles.avatar} src={story.cover} alt="" /> : <span className={styles.avatar} />}
            <div className={styles.who}>
              <h1 className={styles.title}>{story.title}</h1>
              <span className={styles.by}>Radio Creștin{fast ? " · 2×" : ""}</span>
            </div>
            {slide.hasSound && (
              <button type="button" className={styles.icon} aria-label={muted ? "Pornește sunetul" : "Oprește sunetul"} onClick={() => setMuted((m) => !m)}>
                {muted ? <MutedIcon /> : <SoundIcon />}
              </button>
            )}
            <button type="button" className={styles.icon} aria-label={paused ? "Redă" : "Pauză"} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
              {paused ? <PlayIcon /> : <PauseIcon />}
            </button>
            <a href="/" className={styles.icon} aria-label="Închide">
              <CloseIcon />
            </a>
          </div>
        </div>

        {ended && (
          <div className={styles.end}>
            <button type="button" className={styles.replay} onClick={restart}>
              ↻ Revezi povestea
            </button>
          </div>
        )}

        <div className={styles.rail}>
          <button
            type="button"
            className={liked ? `${styles.railButton} ${styles.liked}` : styles.railButton}
            aria-label={liked ? "Nu-mi mai place" : "Îmi place"}
            aria-pressed={liked}
            onClick={() => void toggleLike()}
            data-testid="story-like"
          >
            <HeartIcon filled={liked} />
            <span className={styles.railLabel}>{formatCount(likes)}</span>
          </button>
          <button type="button" className={styles.railButton} aria-label="Distribuie" onClick={share} data-testid="story-share">
            <ShareIcon />
            <span className={styles.railLabel}>Distribuie</span>
          </button>
        </div>

        <div className={styles.bottom}>
          {slide.cta && (
            <a
              key={`${slide.id}-${index}`}
              className={ctaShown ? `${styles.cta} ${styles.ctaIn}` : styles.cta}
              href={slide.cta.href}
              aria-hidden={!ctaShown}
              tabIndex={ctaShown ? undefined : -1}
              data-testid="story-cta"
              onClick={() => void report([{ type: "cta_click", story: story.slug, slide: slide.id, target: "button" }])}
              {...(slide.cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              <span className={styles.ctaIcon} aria-hidden="true">
                <LinkIcon />
              </span>
              <span className={styles.ctaLabel}>{slide.cta.label}</span>
              <span className={styles.ctaArrow} aria-hidden="true">
                <Chevron />
              </span>
            </a>
          )}
        </div>
      </div>
      {index < count - 1 && (
        <button type="button" className={`${styles.side} ${styles.sideNext}`} aria-label="Înainte" onClick={() => go(index + 1)}>
          <Chevron />
        </button>
      )}
    </div>
  );
}

interface LayerProps {
  slide: StorySlideView;
  active: boolean;
  onLoaded: () => void;
  videoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  onVideoEnded: () => void;
  onEmbedOpen: () => void;
}

/** One slide's media, mounted ahead of time so it has loaded when it comes on. */
function SlideLayer({ slide, active, onLoaded, videoRef, onVideoEnded, onEmbedOpen }: LayerProps) {
  const imgRef = useCallback(
    (img: HTMLImageElement | null) => {
      // Already in the cache (or server-rendered and loaded before hydration).
      if (img?.complete && img.naturalWidth > 0) onLoaded();
    },
    [onLoaded],
  );
  // A slide that leaves the stage stops, and starts from the beginning when it comes back.
  const ownVideo = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = ownVideo.current;
    if (v && !active) {
      v.pause();
      v.currentTime = 0;
    }
  }, [active]);
  const cls = [styles.layer, active ? styles.active : "", slide.landscape ? styles.landscape : ""].join(" ");
  const media: StoryMedia = slide.media;
  return (
    <div className={cls} aria-hidden={!active}>
      {media.kind === "image" && (
        <img ref={imgRef} src={media.src} alt="" draggable={false} onLoad={onLoaded} onError={onLoaded} />
      )}
      {media.kind === "video" && (
        <video
          ref={(v) => {
            ownVideo.current = v;
            if (videoRef) videoRef.current = v;
            if (v && v.readyState >= 3) onLoaded();
          }}
          src={media.src}
          poster={media.poster}
          preload="auto"
          playsInline
          muted
          onCanPlay={onLoaded}
          onError={onLoaded}
          onEnded={active ? onVideoEnded : undefined}
        />
      )}
      {media.kind === "youtube" && <YouTubeLayer media={media} active={active} imgRef={imgRef} onLoaded={onLoaded} onOpen={onEmbedOpen} />}
      {media.kind === "instagram" && <InstagramLayer media={media} imgRef={imgRef} onLoaded={onLoaded} />}
    </div>
  );
}

function YouTubeLayer({
  media,
  active,
  imgRef,
  onLoaded,
  onOpen,
}: {
  media: Extract<StoryMedia, { kind: "youtube" }>;
  active: boolean;
  imgRef: (img: HTMLImageElement | null) => void;
  onLoaded: () => void;
  onOpen: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!active) setPlaying(false);
  }, [active]);
  if (playing) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${media.videoId}?autoplay=1&playsinline=1`}
        title={media.title ?? "YouTube"}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    );
  }
  return (
    <>
      <img ref={imgRef} src={media.thumbnail} alt="" draggable={false} onLoad={onLoaded} onError={onLoaded} />
      <button
        type="button"
        className={styles.play}
        aria-label={`Redă ${media.title ?? "clipul"} pe YouTube`}
        onClick={() => {
          setPlaying(true);
          onOpen();
        }}
      >
        <PlayIcon />
      </button>
    </>
  );
}

/** The thumbnail with its author and caption; none, or it expired: Instagram's embed. */
function InstagramLayer({
  media,
  imgRef,
  onLoaded,
}: {
  media: Extract<StoryMedia, { kind: "instagram" }>;
  imgRef: (img: HTMLImageElement | null) => void;
  onLoaded: () => void;
}) {
  const [embed, setEmbed] = useState(!media.thumbnail);
  if (embed) return <iframe src={media.embedUrl} title="Instagram" onLoad={onLoaded} />;
  return (
    <>
      <img ref={imgRef} src={media.thumbnail} alt="" draggable={false} onLoad={onLoaded} onError={() => setEmbed(true)} />
      <a className={styles.caption} href={media.url} target="_blank" rel="noopener noreferrer">
        {media.author && <strong>@{media.author}</strong>}
        {media.caption && <span>{media.caption}</span>}
      </a>
    </>
  );
}

const Svg = ({ children, ...rest }: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    {children}
  </svg>
);
const HeartIcon = ({ filled }: { filled: boolean }) => (
  <Svg fill={filled ? "currentColor" : "none"}>
    <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.3 3.1 4.5 6.9 4.5c2.1 0 3.5 1.1 5.1 3 1.6-1.9 3-3 5.1-3 3.8 0 6 3.8 4.5 7.3C19.5 16.4 12 21 12 21z" />
  </Svg>
);
const ShareIcon = () => (
  <Svg>
    <path d="M22 3 9.2 15.8" />
    <path d="M22 3 15 21l-3.8-7.2L4 10z" />
  </Svg>
);
const PauseIcon = () => (
  <Svg fill="currentColor" stroke="none">
    <rect x="6" y="4.5" width="4" height="15" rx="1" />
    <rect x="14" y="4.5" width="4" height="15" rx="1" />
  </Svg>
);
const PlayIcon = () => (
  <Svg fill="currentColor" stroke="none">
    <path d="M7 4.5v15l13-7.5z" />
  </Svg>
);
const SoundIcon = () => (
  <Svg>
    <path d="M11 5 6 9H3v6h3l5 4z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </Svg>
);
const MutedIcon = () => (
  <Svg>
    <path d="M11 5 6 9H3v6h3l5 4z" />
    <path d="m16 9 6 6M22 9l-6 6" />
  </Svg>
);
const LinkIcon = () => (
  <Svg width="18" height="18" strokeWidth="2.4">
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </Svg>
);
const CloseIcon = () => (
  <Svg>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
const Chevron = ({ left }: { left?: boolean }) => (
  <Svg>
    <path d={left ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
  </Svg>
);
