// The story share page (/poveste/<slug>/): the story's slides one at a time, the slide's CTA,
// "open in the app" and the store links. A built page arrives with its story (server-rendered,
// with its share preview) and asks the API again for a fresh copy; the fallback page
// (/poveste/?s=<slug>, for stories added after the deploy) arrives without one and asks only.
import React, { useCallback, useEffect, useState } from "react";
import { fetchStory } from "@/services/stories";
import { STORY_PATH, STORY_SLUG, appLinks, type StoryMedia, type StoryView } from "@/utils/stories";
import styles from "./StoryPage.module.scss";

type State = { kind: "story"; story: StoryView } | { kind: "loading" } | { kind: "gone" } | { kind: "error"; slug: string };

interface Props {
  /** The story as built; absent on the fallback page, which reads the slug from the URL. */
  story?: StoryView | null;
}

/** The fallback page's slug: ?s=<slug>, or the path when the 404 page kept it. */
const slugFromLocation = (): string | null => {
  const fromQuery = new URLSearchParams(window.location.search).get("s") ?? "";
  if (STORY_SLUG.test(fromQuery)) return fromQuery;
  return window.location.pathname.match(STORY_PATH)?.[1] ?? null;
};

export default function StoryPage({ story }: Props) {
  const [state, setState] = useState<State>(story ? { kind: "story", story } : { kind: "loading" });

  const load = useCallback(async (slug: string, hadStory: boolean) => {
    const result = await fetchStory(slug);
    if (result === "error") {
      // Offline or the API is down: a built page keeps what it has.
      if (!hadStory) setState({ kind: "error", slug });
    } else if (result === "gone") {
      setState({ kind: "gone" });
    } else {
      setState({ kind: "story", story: result });
    }
  }, []);

  useEffect(() => {
    if (story) {
      void load(story.slug, true);
      return;
    }
    const slug = slugFromLocation();
    if (!slug) {
      setState({ kind: "gone" });
      return;
    }
    // Show the share URL, not the fallback's query.
    if (window.location.pathname !== `/poveste/${slug}/`) {
      window.history.replaceState(null, "", `/poveste/${slug}/${window.location.hash}`);
    }
    void load(slug, false);
  }, [story, load]);

  useEffect(() => {
    if (state.kind === "story") document.title = `${state.story.title} | Radio Creștin`;
    else if (state.kind === "gone") document.title = "Povestea nu mai este disponibilă | Radio Creștin";
  }, [state]);

  return (
    <div className={styles.page}>
      <a href="/" className={styles.home}>← Radio Creștin</a>
      {state.kind === "story" && <StoryViewer story={state.story} />}
      {state.kind === "loading" && <p className={styles.status} role="status">Se încarcă povestea…</p>}
      {state.kind === "gone" && <StoryGone />}
      {state.kind === "error" && (
        <div className={styles.message}>
          <h1>Povestea nu s-a putut încărca</h1>
          <p>Verifică conexiunea la internet și încearcă din nou.</p>
          <button type="button" className={styles.primary} onClick={() => { setState({ kind: "loading" }); void load(state.slug, false); }}>
            Încearcă din nou
          </button>
        </div>
      )}
      {state.kind !== "loading" && <AppBox slug={state.kind === "story" ? state.story.slug : null} />}
    </div>
  );
}

function StoryGone() {
  return (
    <div className={styles.message} data-testid="story-gone">
      <h1>Povestea nu mai este disponibilă</h1>
      <p>Poate a expirat sau linkul nu este corect. Între timp, ascultă radiourile creștine preferate.</p>
      <a href="/" className={styles.primary}>Mergi la pagina principală</a>
    </div>
  );
}

function StoryViewer({ story }: { story: StoryView }) {
  const [index, setIndex] = useState(0);
  const count = story.slides.length;
  const current = story.slides[Math.min(index, count - 1)];
  const go = useCallback((to: number) => setIndex(Math.max(0, Math.min(count - 1, to))), [count]);

  useEffect(() => setIndex(0), [story.slug]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  return (
    <article className={styles.story} data-testid="story">
      <h1 className={styles.title}>{story.title}</h1>
      <div className={styles.frame}>
        {count > 1 && (
          <div className={styles.progress} role="tablist" aria-label="Diapozitive">
            {story.slides.map((slide, i) => (
              <button
                key={slide.id || i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Diapozitivul ${i + 1} din ${count}`}
                className={i <= index ? styles.segmentDone : styles.segment}
                onClick={() => go(i)}
              />
            ))}
          </div>
        )}
        <div className={current.landscape ? `${styles.media} ${styles.landscape}` : styles.media} key={current.id || index}>
          <SlideMedia media={current.media} />
        </div>
        {index > 0 && (
          <button type="button" className={`${styles.nav} ${styles.prev}`} aria-label="Înapoi" onClick={() => go(index - 1)}>‹</button>
        )}
        {index < count - 1 && (
          <button type="button" className={`${styles.nav} ${styles.next}`} aria-label="Înainte" onClick={() => go(index + 1)}>›</button>
        )}
      </div>
      {current.cta && (
        <a
          className={styles.cta}
          href={current.cta.href}
          {...(current.cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {current.cta.label}
        </a>
      )}
      {count > 1 && <p className={styles.counter}>{index + 1} / {count}</p>}
    </article>
  );
}

function SlideMedia({ media }: { media: StoryMedia }) {
  switch (media.kind) {
    case "image":
      return <img src={media.src} alt="" />;
    case "video":
      return <video src={media.src} poster={media.poster} controls playsInline preload="metadata" />;
    case "youtube":
      return <YouTubeSlide media={media} />;
    case "instagram":
      return <InstagramSlide media={media} />;
  }
}

/** A thumbnail until it's tapped, then YouTube's player (no third-party load before that). */
function YouTubeSlide({ media }: { media: Extract<StoryMedia, { kind: "youtube" }> }) {
  const [playing, setPlaying] = useState(false);
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
    <button type="button" className={styles.facade} onClick={() => setPlaying(true)} aria-label={`Redă ${media.title ?? "clipul"} pe YouTube`}>
      <img src={media.thumbnail} alt="" />
      <span className={styles.play} aria-hidden="true">▶</span>
    </button>
  );
}

/** The thumbnail with its author and caption, else (none, or it expired) Instagram's embed. */
function InstagramSlide({ media }: { media: Extract<StoryMedia, { kind: "instagram" }> }) {
  const [embed, setEmbed] = useState(!media.thumbnail);
  if (embed) return <iframe src={media.embedUrl} title="Instagram" loading="lazy" />;
  return (
    <a className={styles.instagram} href={media.url} target="_blank" rel="noopener noreferrer">
      <img src={media.thumbnail} alt="" onError={() => setEmbed(true)} />
      <span className={styles.caption}>
        {media.author && <strong>@{media.author}</strong>}
        {media.caption && <span>{media.caption}</span>}
        <span className={styles.igOpen}>Deschide în Instagram</span>
      </span>
    </a>
  );
}

/** Open the app (app link / scheme), or get it from the stores. */
function AppBox({ slug }: { slug: string | null }) {
  const links = appLinks(slug ?? "");
  const [platform, setPlatform] = useState<"android" | "ios" | "other">("other");
  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(/android/i.test(ua) ? "android" : /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) ? "ios" : "other");
  }, []);

  const openApp = (e: React.MouseEvent) => {
    if (platform !== "ios") return; // Android: the intent link falls back to the Play Store itself.
    e.preventDefault();
    // No app: the page stays visible and the visitor goes to the App Store.
    const timer = window.setTimeout(() => { if (!document.hidden) window.location.href = links.iosStore; }, 1600);
    document.addEventListener("visibilitychange", () => window.clearTimeout(timer), { once: true });
    window.location.href = links.ios;
  };

  return (
    <aside className={styles.app}>
      <p className={styles.appTitle}>{slug ? "Vezi povestea în aplicația Radio Creștin" : "Aplicația Radio Creștin"}</p>
      <p className={styles.appText}>Peste 60 de radiouri creștine, gratuit și fără reclame.</p>
      {slug && platform !== "other" && (
        <a className={styles.primary} href={platform === "android" ? links.android : links.ios} onClick={openApp} data-testid="open-app">
          Deschide în aplicație
        </a>
      )}
      <div className={styles.stores}>
        <a href={links.iosStore} target="_blank" rel="noopener noreferrer">
          <img src="/images/download_appstore_ro.svg" alt="Descarcă din App Store" width="135" height="40" />
        </a>
        <a href={links.androidStore} target="_blank" rel="noopener noreferrer">
          <img src="/images/download_playstore_ro.svg" alt="Descarcă din Google Play" width="135" height="40" />
        </a>
      </div>
    </aside>
  );
}
