import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./styles.module.scss";

export type ReviewsModalView = "list" | "write";

interface ReviewsModalShellProps {
  view: ReviewsModalView | null;
  stationTitle: string;
  closeDisabled?: boolean;
  onClose: () => void;
  renderPanel: (view: ReviewsModalView) => React.ReactNode;
}

type AnimPhase = "enter" | "idle" | "swap_out" | "swap_in" | "closing";

const SWAP_OUT_MS = 150;
const CLOSE_MS = 180;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// One overlay for both review modals. The dim + blur backdrop stays mounted
// while the list/write panels swap inside it — two separate portals would
// drop the backdrop-filter for a frame and re-fade it, a visible blur pop.
// Panel swaps are sequenced (old eases out, then new eases in) so the two
// differently-sized panels are never on screen together.
const ReviewsModalShell: React.FC<ReviewsModalShellProps> = ({
  view,
  stationTitle,
  closeDisabled = false,
  onClose,
  renderPanel,
}) => {
  const [shownView, setShownView] = useState<ReviewsModalView | null>(view);
  const [anim, setAnim] = useState<AnimPhase>(view ? "enter" : "idle");
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timerRef.current);
    const reduced = prefersReducedMotion();

    if (view === null) {
      if (shownView === null) return;
      if (reduced) {
        setShownView(null);
        setAnim("idle");
        return;
      }
      setAnim("closing");
      timerRef.current = window.setTimeout(() => {
        setShownView(null);
        setAnim("idle");
      }, CLOSE_MS);
    } else if (shownView === null) {
      setShownView(view);
      setAnim(reduced ? "idle" : "enter");
    } else if (view !== shownView) {
      if (reduced) {
        setShownView(view);
        setAnim("idle");
        return;
      }
      setAnim("swap_out");
      timerRef.current = window.setTimeout(() => {
        setShownView(view);
        setAnim("swap_in");
      }, SWAP_OUT_MS);
    } else if (anim === "swap_out" || anim === "closing") {
      // Interrupted mid-exit and asked to show the same view again
      setAnim("swap_in");
    }
    // Transition machine: reacts to the commanded view only; shownView/anim
    // are read as the current snapshot, not re-triggers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  // Body scroll lock for the whole time the shell is on screen — including
  // panel swaps, which used to unlock + relock between the two modals
  const mounted = shownView !== null;
  useEffect(() => {
    if (!mounted) return;
    const scrollY = window.scrollY;
    document.body.style.cssText = `overflow-y: scroll; position: fixed; width: 100%; top: -${scrollY}px`;
    return () => {
      document.body.style.cssText = "";
      window.scrollTo(0, scrollY);
    };
  }, [mounted]);

  useEffect(() => {
    if (view === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !closeDisabled) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [view, closeDisabled, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !closeDisabled) {
      onClose();
    }
  };

  if (shownView === null) return null;

  const overlayClass = [
    styles.modal_overlay,
    anim === "enter" ? styles.overlay_enter : "",
    anim === "closing" ? styles.overlay_closing : "",
  ]
    .filter(Boolean)
    .join(" ");

  const stageClass = [styles.panel_stage, styles[`stage_${anim}`] || ""]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div
      className={overlayClass}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={
        shownView === "list"
          ? `Recenzii ${stationTitle}`
          : `Adaugă o recenzie pentru ${stationTitle}`
      }
    >
      <div className={stageClass}>{renderPanel(shownView)}</div>
    </div>,
    document.body
  );
};

export default ReviewsModalShell;
