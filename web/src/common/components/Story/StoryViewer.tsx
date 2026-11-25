// The viewer the stories bar opens over the page (a lazy chunk): the story's player, full screen
// on a phone, a card on a dark backdrop on a desktop. After a story's last slide it goes on to
// the next one in the bar, back from the first slide to the previous one, and closes after the
// last; Escape and the close button close it.
import React, { useEffect, useState } from "react";
import { fetchStoryCached } from "@/services/stories";
import type { StoryView } from "@/utils/stories";
import StoryPlayer from "./StoryPlayer";
import styles from "./StoryViewer.module.scss";

interface Props {
  slug: string;
  /** The bar's order, for next / previous. */
  order: string[];
  onOpen: (slug: string) => void;
  onClose: () => void;
}

export default function StoryViewer({ slug, order, onOpen, onClose }: Props) {
  const [story, setStory] = useState<StoryView | "loading" | "gone" | "error">("loading");

  useEffect(() => {
    let alive = true;
    setStory("loading");
    void fetchStoryCached(slug).then((result) => alive && setStory(result));
    return () => {
      alive = false;
    };
  }, [slug]);

  // The page under it doesn't scroll.
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, []);

  useEffect(() => {
    if (typeof story === "object") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [story, onClose]);

  const at = order.indexOf(slug);
  const next = at >= 0 && at < order.length - 1 ? order[at + 1] : null;
  const previous = at > 0 ? order[at - 1] : null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Poveste" data-testid="story-viewer">
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      {typeof story === "object" ? (
        <StoryPlayer
          key={story.slug}
          story={story}
          onClose={onClose}
          onFinished={() => (next ? onOpen(next) : onClose())}
          onBackFromStart={previous ? () => onOpen(previous) : undefined}
        />
      ) : (
        <div className={styles.card}>
          <button type="button" className={styles.close} aria-label="Închide" onClick={onClose}>
            ✕
          </button>
          {story === "loading" && <span className={styles.spinner} role="status" aria-label="Se încarcă" />}
          {story === "gone" && <p className={styles.message}>Povestea nu mai este disponibilă.</p>}
          {story === "error" && <p className={styles.message}>Povestea nu s-a putut încărca. Verifică conexiunea.</p>}
        </div>
      )}
    </div>
  );
}
