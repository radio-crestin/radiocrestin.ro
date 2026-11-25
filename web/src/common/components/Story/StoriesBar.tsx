// The stories bar above the announcements on the home and station pages, like the app's
// (mobile/lib/widgets/stories_bar.dart): a round picture per story with its title under it, new
// ones first with a coloured ring, seen ones with a grey ring. Tapping one opens the viewer over
// the page (#poveste/<slug>), so a playing station keeps playing.
//
// The build server-renders the bubbles it read; after load the fresh list replaces them (new
// stories, ended ones gone), and each one's ring follows this device's history.
import React, { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fetchStoryBubbles, fetchStoryCached } from "@/services/stories";
import { orderBubbles, isBubbleSeen, type SeenStories, type StoryBubble } from "@/utils/stories";
import { readSeenStories, SEEN_EVENT } from "./seen";
import styles from "./StoriesBar.module.scss";

const StoryViewer = lazy(() => import("./StoryViewer"));
const loadViewer = () => import("./StoryViewer");

export const HASH_PREFIX = "#poveste/";
const slugFromHash = () => (window.location.hash.startsWith(HASH_PREFIX) ? window.location.hash.slice(HASH_PREFIX.length) : null);

const StoriesContext = createContext<StoryBubble[] | undefined>(undefined);
export const StoriesProvider = ({ stories, children }: { stories?: StoryBubble[]; children: React.ReactNode }) => (
  <StoriesContext.Provider value={stories}>{children}</StoriesContext.Provider>
);

export default function StoriesBar() {
  const built = useContext(StoriesContext);
  const [bubbles, setBubbles] = useState<StoryBubble[]>(built ?? []);
  const [seen, setSeen] = useState<SeenStories>({});
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  // The order next / previous follow, as the bar was when the viewer opened (opening marks a
  // story seen, which moves it to the end of the bar).
  const [viewOrder, setViewOrder] = useState<string[]>([]);

  useEffect(() => {
    setHydrated(true);
    setSeen(readSeenStories());
    const onSeen = () => setSeen(readSeenStories());
    window.addEventListener(SEEN_EVENT, onSeen);
    void fetchStoryBubbles().then((fresh) => fresh && setBubbles(fresh));
    return () => window.removeEventListener(SEEN_EVENT, onSeen);
  }, []);

  // The server renders the build's order; the browser puts this device's new stories first.
  const ordered = useMemo(
    () => (hydrated ? orderBubbles(bubbles, seen) : bubbles),
    [bubbles, seen, hydrated],
  );

  const openRef = useRef<string | null>(null);
  const orderRef = useRef<string[]>([]);
  orderRef.current = ordered.map((b) => b.slug);

  // #poveste/<slug>: open on load and with Back / Forward.
  useEffect(() => {
    const sync = () => {
      const slug = slugFromHash();
      if (slug && !openRef.current) setViewOrder(orderRef.current);
      openRef.current = slug;
      setOpen(slug);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  // Opening adds one history entry (Back closes the viewer); moving between stories replaces it.
  const pushed = useRef(false);
  const openStory = useCallback((slug: string) => {
    pushed.current = true;
    window.location.hash = `${HASH_PREFIX.slice(1)}${slug}`;
  }, []);
  const switchStory = useCallback((slug: string) => {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${HASH_PREFIX}${slug}`);
    openRef.current = slug;
    setOpen(slug);
  }, []);
  const closeViewer = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back(); // the hashchange closes it
      return;
    }
    // Opened from a #poveste link: drop the hash, stay on the page.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    openRef.current = null;
    setOpen(null);
  }, []);
  const prefetch = (slug: string) => {
    void loadViewer();
    void fetchStoryCached(slug);
  };

  if (!ordered.length && !open) return null;
  return (
    <>
      {ordered.length > 0 && (
        <nav className={styles.bar} aria-label="Povești" data-testid="stories-bar">
          <ul className={styles.list}>
            {ordered.map((bubble) => {
              const isNew = !hydrated || !isBubbleSeen(bubble, seen);
              return (
                <li key={bubble.slug}>
                  <a
                    href={`/poveste/${bubble.slug}/`}
                    className={isNew ? `${styles.bubble} ${styles.new}` : styles.bubble}
                    data-testid={`story-bubble-${bubble.slug}`}
                    aria-label={`${bubble.title}${isNew ? " (poveste nouă)" : ""}`}
                    onPointerEnter={() => prefetch(bubble.slug)}
                    onTouchStart={() => prefetch(bubble.slug)}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return; // a new tab: the share page
                      e.preventDefault();
                      openStory(bubble.slug);
                    }}
                  >
                    <span className={styles.ring}>
                      <span className={styles.gap}>
                        {bubble.cover ? (
                          <img src={bubble.cover} alt="" width={58} height={58} loading="lazy" decoding="async" />
                        ) : (
                          <span className={styles.placeholder} aria-hidden="true">
                            <StoriesIcon />
                          </span>
                        )}
                      </span>
                    </span>
                    <span className={styles.title}>{bubble.title}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
      {open && (
        <Suspense fallback={null}>
          <StoryViewer slug={open} order={viewOrder} onOpen={switchStory} onClose={closeViewer} />
        </Suspense>
      )}
    </>
  );
}

// Material's auto_stories, for a story without a picture (as in the app).
const StoriesIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
    <path d="M19 1l-5 5v11l5-4.5V1zM1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5V6c-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6zm22 13.5V6c-.6-.45-1.25-.75-2-1v13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5v2c1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5v-1.1z" />
  </svg>
);
