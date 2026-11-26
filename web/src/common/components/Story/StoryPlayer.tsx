// The stories player, like Instagram's: progress bars that fill as each slide plays, a slide
// shown only once its media has loaded (the next one loads meanwhile), tap the left third to go
// back and the rest to go on, swipe left / right, press and hold to play at double speed, a
// pause and a sound button, and like and share. Arrow keys and Space work on a keyboard.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { sendStoryEvents, type StoryEvent } from "@/services/stories";
import { getUserId } from "@/utils/posthog";
import { shareLink } from "@/components/Announcements/share";
import {
  appLinks,
  formatStoryCount,
  type StoryMedia,
  type StorySlideView,
  type StoryView,
} from "@/utils/stories";
import { markStorySeen } from "./seen";
import styles from "./StoryPlayer.module.scss";

export const HOLD_MS = 220;
export const FAST_RATE = 2;
/**
 * The CTA (button bar or swipe-up hint) starts hidden and comes in once the slide has played
 * CTA_SHOW_AFTER_MS, or CTA_SHOW_MAX_SHARE of it when that is sooner (a short slide or video).
 * The bar comes in glassy, and its colour sweeps in from the left CTA_FILL_DELAY_MS later.
 */
export const CTA_SHOW_AFTER_MS = 4000;
export const CTA_SHOW_MAX_SHARE = 0.3;
export const CTA_FILL_DELAY_MS = 1000;
export const ctaShowAt = (totalMs: number) =>
  Math.min(CTA_SHOW_AFTER_MS, CTA_SHOW_MAX_SHARE * totalMs);
const SWIPE_PX = 50;
const LOAD_TIMEOUT_MS = 10_000;
const LIKES_KEY = "stories-liked";

const report = (events: StoryEvent[]) => sendStoryEvents(events, getUserId());

const readLiked = (): string[] => {
  try {
    const value = JSON.parse(localStorage.getItem(LIKES_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((s) => typeof s === "string")
      : [];
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
    localStorage.setItem(
      LIKES_KEY,
      JSON.stringify(next ? [...others, story.slug] : others),
    );
    const answer = await report([
      { type: next ? "like" : "unlike", story: story.slug },
    ]);
    const fresh = answer?.like_counts?.[story.slug];
    if (typeof fresh === "number") setCount(fresh);
  }, [liked, story.slug]);

  return { liked, count, toggle };
}

interface PlayerProps {
  story: StoryView;
  /** In the in-page viewer: close it (on the share page the close button goes home). */
  onClose?: () => void;
  /** After the last slide (the viewer goes to the next story); absent: "Revezi povestea". */
  onFinished?: () => void;
  /** Back from the first slide (the viewer goes to the previous story); absent: replay it. */
  onBackFromStart?: () => void;
}

export default function StoryPlayer({
  story,
  onClose,
  onFinished,
  onBackFromStart,
}: PlayerProps) {
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
  // 0: hidden, 1: shown (glassy), 2: filled with its colour.
  const [ctaPhase, setCtaPhase] = useState<0 | 1 | 2>(0);
  const ctaShown = ctaPhase > 0;
  const ctaFilled = ctaPhase === 2;
  // Comments are read and written in the app: the button says so, with a way there.
  const [commentsPrompt, setCommentsPrompt] = useState(false);
  const ctaPhaseRef = useRef(0);
  const { liked, count: likes, toggle: toggleLike } = useStoryLike(story);

  const barRef = useRef<HTMLSpanElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const elapsed = useRef(0);
  const slide = slides[Math.min(index, count - 1)];
  const ready = !!loaded[index];
  const running =
    ready && !paused && !ended && !embedOpen && !hidden && !commentsPrompt;

  const markLoaded = useCallback(
    (i: number) => setLoaded((l) => (l[i] ? l : { ...l, [i]: true })),
    [],
  );

  const setBar = (fraction: number) => {
    if (barRef.current)
      barRef.current.style.transform = `scaleX(${Math.min(1, Math.max(0, fraction))})`;
  };

  const go = useCallback(
    (to: number) => {
      if (to < 0 && onBackFromStart) {
        onBackFromStart();
        return;
      }
      if (to < 0) {
        // Back on the first slide: play it again.
        elapsed.current = 0;
        ctaPhaseRef.current = 0;
        setCtaPhase(0);
        setBar(0);
        if (videoRef.current) videoRef.current.currentTime = 0;
        return;
      }
      if (to >= count) {
        void report([{ type: "complete", story: story.slug }]);
        if (onFinished) {
          onFinished();
          return;
        }
        setEnded(true);
        setBar(1);
        return;
      }
      setEnded(false);
      setEmbedOpen(false);
      setIndex(to);
    },
    [count, story.slug, onFinished, onBackFromStart],
  );

  // A new story: from the start, and one "view".
  useEffect(() => {
    setIndex(0);
    setEnded(false);
    void report([{ type: "view", story: story.slug }]);
    markStorySeen(story.slug, story.updatedAt);
  }, [story.slug, story.updatedAt]);

  // Each slide: progress from zero, a "slide_view", and a fallback if its media never loads.
  useEffect(() => {
    elapsed.current = 0;
    setBar(0);
    ctaPhaseRef.current = 0;
    setCtaPhase(0);
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
      if (!slide.cta || ctaPhaseRef.current === 2) return;
      const showAt = ctaShowAt(totalMs);
      const phase =
        playedMs >= showAt + CTA_FILL_DELAY_MS ? 2 : playedMs >= showAt ? 1 : 0;
      if (phase > ctaPhaseRef.current) {
        ctaPhaseRef.current = phase;
        setCtaPhase(phase);
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
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("input, textarea")
      )
        return;
      if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
      else if (e.key === "Escape" && onClose) onClose();
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, onClose]);

  // Gestures: tap (left third back, else on), swipe left / right, press and hold for double speed.
  const gesture = useRef<{
    x: number;
    y: number;
    id: number;
    holdTimer: number;
    held: boolean;
    swiping: boolean;
  } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (
      (e.target as HTMLElement).closest(
        "button, a, iframe, input, form, video[controls]",
      ) ||
      e.button > 0
    )
      return;
    const holdTimer = window.setTimeout(() => {
      if (gesture.current) {
        gesture.current.held = true;
        setFast(true);
      }
    }, HOLD_MS);
    gesture.current = {
      x: e.clientX,
      y: e.clientY,
      id: e.pointerId,
      holdTimer,
      held: false,
      swiping: false,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId || g.held) return;
    const dx = e.clientX - g.x;
    if (
      !g.swiping &&
      Math.abs(dx) > 12 &&
      Math.abs(dx) > Math.abs(e.clientY - g.y)
    ) {
      g.swiping = true;
      window.clearTimeout(g.holdTimer);
    }
    if (g.swiping && stageRef.current)
      stageRef.current.style.transform = `translateX(${dx * 0.6}px)`;
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
  const mounted = [index - 1, index, index + 1].filter(
    (i) => i >= 0 && i < count,
  );

  return (
    <div className={styles.wrap}>
      {(index > 0 || onBackFromStart) && (
        <button
          type="button"
          className={`${styles.side} ${styles.sidePrev}`}
          aria-label="Înapoi"
          onClick={() => go(index - 1)}
        >
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

        <div className={styles.shade} aria-hidden="true" />

        {fast && (
          <span className={styles.fastBadge} aria-live="polite">
            2×
          </span>
        )}
        {paused && !ended && (
          <span className={styles.pausedBadge} aria-hidden="true">
            <PlayIcon />
          </span>
        )}

        {/* Like the app: the chrome fades while a finger holds the slide. */}
        <div
          className={
            fast ? `${styles.chrome} ${styles.chromeHidden}` : styles.chrome
          }
        >
          <div className={styles.top}>
            <div
              className={styles.bars}
              role="tablist"
              aria-label="Diapozitive"
            >
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
                    style={{
                      transform: `scaleX(${i < index || (ended && i === index) ? 1 : 0})`,
                    }}
                  />
                </button>
              ))}
            </div>
            <div className={styles.head}>
              <h1 className={styles.srOnly}>{story.title}</h1>
              {slide.hasSound && (
                <button
                  type="button"
                  className={styles.icon}
                  aria-label={muted ? "Pornește sunetul" : "Oprește sunetul"}
                  onClick={() => setMuted((m) => !m)}
                >
                  {muted ? <MutedIcon /> : <SoundIcon />}
                </button>
              )}
              {onClose ? (
                <button
                  type="button"
                  className={styles.icon}
                  aria-label="Închide"
                  onClick={onClose}
                  data-testid="story-close"
                >
                  <CloseIcon />
                </button>
              ) : (
                <a
                  href="/"
                  className={styles.icon}
                  aria-label="Închide"
                  data-testid="story-close"
                >
                  <CloseIcon />
                </a>
              )}
            </div>
          </div>

          {ended && (
            <div className={styles.end}>
              <button type="button" className={styles.replay} onClick={restart}>
                ↻ Revezi povestea
              </button>
            </div>
          )}

          {/* As the app's _Bottom (Reels): CTA and who it's from on the left, the actions on the right. */}
          <div className={styles.bottom}>
            <div className={styles.bottomRow}>
              <div className={styles.left}>
                {slide.cta && slide.cta.style !== "swipe_up" && (
                  // Opens its room smoothly, pushing who-it's-from up, when it comes in.
                  <div
                    className={
                      ctaShown
                        ? `${styles.ctaRoom} ${styles.ctaRoomOpen}`
                        : styles.ctaRoom
                    }
                    aria-hidden={!ctaShown}
                  >
                    <div className={styles.ctaRoomInner}>
                      <a
                        key={`cta-${slide.id}-${index}`}
                        tabIndex={ctaShown ? undefined : -1}
                        data-shown={ctaShown ? "1" : "0"}
                        className={
                          ctaFilled
                            ? `${styles.cta} ${styles.ctaFilled}`
                            : styles.cta
                        }
                        style={
                          {
                            "--cta-color": slide.cta.color ?? "#e91e63",
                            "--cta-text": slide.cta.textColor ?? "#fff",
                          } as React.CSSProperties
                        }
                        href={slide.cta.href}
                        data-testid="story-cta"
                        data-filled={ctaFilled ? "1" : "0"}
                        onClick={() =>
                          void report([
                            {
                              type: "cta_click",
                              story: story.slug,
                              slide: slide.id,
                              target: "button",
                            },
                          ])
                        }
                        {...(slide.cta.external
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                      >
                        <span className={styles.ctaSweep} aria-hidden="true" />
                        <span className={styles.ctaLabel}>
                          {slide.cta.label}
                        </span>
                        <ChevronRight />
                      </a>
                    </div>
                  </div>
                )}
                <div className={styles.author}>
                  <span className={styles.authorAvatar}>
                    {(story.author?.avatar ?? story.cover) ? (
                      <img
                        src={(story.author?.avatar ?? story.cover)!}
                        alt=""
                      />
                    ) : (
                      <img src="/favicon/android-chrome-192x192.png" alt="" />
                    )}
                  </span>
                  <span className={styles.authorName}>
                    {story.author?.name ?? story.title}
                  </span>
                </div>
                {(slide.caption ?? (story.author ? story.title : null)) && (
                  <p className={styles.caption}>
                    {slide.caption ?? story.title}
                  </p>
                )}
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={
                    liked ? `${styles.action} ${styles.liked}` : styles.action
                  }
                  aria-label={liked ? "Nu-mi mai place" : "Îmi place"}
                  aria-pressed={liked}
                  onClick={() => void toggleLike()}
                  data-testid="story-like"
                >
                  <HeartIcon filled={liked} />
                  <span
                    key={likes}
                    className={styles.actionLabel}
                    data-testid="story-like-count"
                  >
                    {likes > 0 ? formatStoryCount(likes) : "Îmi place"}
                  </span>
                </button>
                {story.comments.enabled && (
                  <button
                    type="button"
                    className={styles.action}
                    aria-label={`Comentarii (${story.comments.count})`}
                    aria-expanded={commentsPrompt}
                    onClick={() => setCommentsPrompt((open) => !open)}
                    data-testid="story-comments"
                  >
                    <ChatIcon />
                    <span className={styles.actionLabel}>
                      {story.comments.count > 0
                        ? formatStoryCount(story.comments.count)
                        : "Comentarii"}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  className={styles.action}
                  aria-label="Distribuie"
                  onClick={share}
                  data-testid="story-share"
                >
                  <SendIcon />
                  <span className={styles.actionLabel}>Trimite</span>
                </button>
              </div>
            </div>
            {slide.cta && slide.cta.style !== "button" && ctaShown && (
              <a
                className={styles.swipeUp}
                href={slide.cta.href}
                aria-label={slide.cta.label}
                data-testid={
                  slide.cta.style === "swipe_up"
                    ? "story-cta"
                    : "story-swipe-up"
                }
                onClick={() =>
                  void report([
                    {
                      type: "cta_click",
                      story: story.slug,
                      slide: slide.id,
                      target: "swipe_up",
                    },
                  ])
                }
                {...(slide.cta.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                <span className={styles.chevronUp}>
                  <ChevronUp />
                </span>
                <span className={styles.swipeLabel}>
                  {slide.cta.style === "both"
                    ? "Glisează în sus"
                    : slide.cta.label}
                </span>
              </a>
            )}
            {commentsPrompt && (
              <CommentsInApp
                slug={story.slug}
                count={story.comments.count}
                onClose={() => setCommentsPrompt(false)}
              />
            )}
          </div>
        </div>
      </div>
      {(index < count - 1 || onFinished) && (
        <button
          type="button"
          className={`${styles.side} ${styles.sideNext}`}
          aria-label="Înainte"
          onClick={() => go(index + 1)}
        >
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
function SlideLayer({
  slide,
  active,
  onLoaded,
  videoRef,
  onVideoEnded,
  onEmbedOpen,
}: LayerProps) {
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
  const cls = [
    styles.layer,
    active ? styles.active : "",
    slide.landscape ? styles.landscape : "",
  ].join(" ");
  const media: StoryMedia = slide.media;
  return (
    <div className={cls} aria-hidden={!active}>
      {media.kind === "image" && (
        <img
          ref={imgRef}
          src={media.src}
          alt=""
          draggable={false}
          onLoad={onLoaded}
          onError={onLoaded}
        />
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
      {media.kind === "youtube" && (
        <YouTubeLayer
          media={media}
          active={active}
          imgRef={imgRef}
          onLoaded={onLoaded}
          onOpen={onEmbedOpen}
        />
      )}
      {media.kind === "instagram" && (
        <InstagramLayer media={media} imgRef={imgRef} onLoaded={onLoaded} />
      )}
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
      <img
        ref={imgRef}
        src={media.thumbnail}
        alt=""
        draggable={false}
        onLoad={onLoaded}
        onError={onLoaded}
      />
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
  if (embed)
    return <iframe src={media.embedUrl} title="Instagram" onLoad={onLoaded} />;
  return (
    <>
      <img
        ref={imgRef}
        src={media.thumbnail}
        alt=""
        draggable={false}
        onLoad={onLoaded}
        onError={() => setEmbed(true)}
      />
      <a
        className={styles.igCaption}
        href={media.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {media.author && <strong>@{media.author}</strong>}
        {media.caption && <span>{media.caption}</span>}
      </a>
    </>
  );
}

/**
 * Comments live in the app (public, per story): the website shows their count, and this sheet
 * offers the app (its link on a phone, the download page elsewhere). The story waits meanwhile.
 */
function CommentsInApp({
  slug,
  count,
  onClose,
}: {
  slug: string;
  count: number;
  onClose: () => void;
}) {
  const [href, setHref] = useState("/descarca-aplicatia-radio-crestin/");
  useEffect(() => {
    const ua = navigator.userAgent;
    const links = appLinks(slug);
    if (/android/i.test(ua)) setHref(links.android);
    else if (/iphone|ipad|ipod/i.test(ua)) setHref(links.ios);
  }, [slug]);
  return (
    <div
      className={styles.sheet}
      role="dialog"
      aria-label="Comentarii"
      data-testid="story-comments-sheet"
    >
      <button
        type="button"
        className={styles.sheetClose}
        aria-label="Închide"
        onClick={onClose}
      >
        <CloseIcon />
      </button>
      <ChatIcon />
      <p className={styles.sheetTitle}>
        {count > 0
          ? `${formatStoryCount(count)} ${count === 1 ? "comentariu" : "comentarii"}`
          : "Comentarii"}
      </p>
      <p className={styles.sheetText}>
        Comentariile se citesc și se scriu în aplicația Radio Creștin.
      </p>
      <a
        className={styles.sheetButton}
        href={href}
        data-testid="story-comments-app"
      >
        Deschide aplicația
      </a>
    </div>
  );
}

const Svg = ({ children, ...rest }: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);
const HeartIcon = ({ filled }: { filled: boolean }) => (
  <Svg fill={filled ? "currentColor" : "none"}>
    <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.3 3.1 4.5 6.9 4.5c2.1 0 3.5 1.1 5.1 3 1.6-1.9 3-3 5.1-3 3.8 0 6 3.8 4.5 7.3C19.5 16.4 12 21 12 21z" />
  </Svg>
);
// Material's send_rounded, tilted as the app's paper plane.
const SendIcon = () => (
  <Svg
    fill="currentColor"
    stroke="none"
    style={{ transform: "rotate(-29deg)" }}
  >
    <path d="M3.4 20.4 20.85 12.92a1 1 0 0 0 0-1.84L3.4 3.6a.99.99 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
  </Svg>
);
const ChatIcon = () => (
  <Svg strokeWidth="2">
    <path d="M20 4H4a1 1 0 0 0-1 1v15l3.5-3H20a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z" />
  </Svg>
);
const ChevronRight = () => (
  <Svg width="22" height="22" strokeWidth="2.6">
    <path d="M9 6l6 6-6 6" />
  </Svg>
);
const ChevronUp = () => (
  <Svg width="30" height="30" strokeWidth="2.6">
    <path d="M6 15l6-6 6 6" />
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
