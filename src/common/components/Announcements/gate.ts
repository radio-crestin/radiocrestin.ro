// When to load the announcements code: it is off the critical path. Until then the
// server-rendered card (styled by the pre-paint script) is what the visitor sees.
// Main bundle: keep this file tiny.

const SLOTS = "[data-ann-r],[data-ann-b]";

/** A tap that happened before the code loaded, replayed once it has. */
export interface PendingTap {
  /** Announcement slug, or the station slug for a bell. */
  slug: string;
  kind: "link" | "primary" | "dismiss" | "card" | "bell";
}

let pending: PendingTap[] = [];
let live = false;
let gate: Promise<void> | null = null;

/** The announcements code took over: taps go straight to it from now on. */
export const markLive = () => {
  live = true;
};

export const takePendingTaps = (kinds: PendingTap["kind"][]): PendingTap[] => {
  const taken = pending.filter((t) => kinds.includes(t.kind));
  pending = pending.filter((t) => !kinds.includes(t.kind));
  return taken;
};

const tapKind = (el: Element): PendingTap["kind"] | null => {
  if (el.closest("a[href]")) return "link";
  const button = el.closest("button");
  if (!button) return "card";
  if (button.matches("[data-ann-b]")) return "bell";
  if (button.classList.contains("ann-dismiss")) return "dismiss";
  if (button.classList.contains("ann-cta")) return "primary";
  return null; // previous / next: just load
};

/**
 * Resolves on idle after `load`, when a card or bell comes within 200px of the viewport, on
 * the first touch, focus or key in one, or right away for an `#anunt/<slug>` link.
 */
export const whenNeeded = (): Promise<void> =>
  (gate ??= new Promise<void>((resolve) => {
    const go = () => resolve();
    if (location.hash.startsWith("#anunt/")) return go();

    const idle = () =>
      "requestIdleCallback" in window ? requestIdleCallback(go, { timeout: 3000 }) : setTimeout(go, 1500);
    if (document.readyState === "complete") idle();
    else addEventListener("load", idle, { once: true });

    const slots = document.querySelectorAll(SLOTS);
    if (slots.length && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            observer.disconnect();
            go();
          }
        },
        { rootMargin: "200px" },
      );
      slots.forEach((slot) => observer.observe(slot));
    }

    const inSlot = (e: Event) => (e.target as Element | null)?.closest?.(SLOTS);
    for (const type of ["pointerdown", "focusin", "keydown"]) {
      addEventListener(type, (e) => inSlot(e) && go(), { capture: true, passive: true });
    }

    // Taps before the code is live: links navigate as usual (we only note them); the card's
    // own buttons are held and replayed.
    addEventListener(
      "click",
      (e) => {
        const slot = inSlot(e);
        if (live || !slot) return;
        const el = e.target as Element;
        const kind = tapKind(el);
        const slug =
          kind === "bell"
            ? slot.getAttribute("data-ann-b")
            : el.closest("section[data-ann]")?.getAttribute("data-ann");
        if (!kind || !slug) return;
        if (kind !== "link") {
          e.preventDefault();
          e.stopPropagation();
        }
        pending.push({ slug, kind });
        go();
      },
      { capture: true },
    );
  }));
