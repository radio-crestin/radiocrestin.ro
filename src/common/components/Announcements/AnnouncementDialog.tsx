import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { IAnnouncement } from "@/models/Announcement";
import { CloseGlyph } from "./icons";
import { ActionControl, ButtonIcon, CategoryTag, colorVars } from "./Slide";
import { T } from "./strings";
import styles from "./styles";
import { ANNOUNCEMENTS_API_BASE, formPageUrl, recordAnnouncementEvent } from "@/services/announcements";
import { trackForm } from "@/utils/posthog";
import { enhanceYouTubeEmbeds } from "./youtubeFacade";

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  announcement: IAnnouncement | null;
  loading: boolean;
  onClose: () => void;
  onPrimary: (announcement: IAnnouncement) => void;
}

/** Locks page scroll while mounted, keeping the scroll position (same approach as ReviewModal). */
const useScrollLock = () => {
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.cssText = `overflow-y: scroll; position: fixed; width: 100%; top: -${scrollY}px`;
    return () => {
      document.body.style.cssText = "";
      window.scrollTo(0, scrollY);
    };
  }, []);
};

/** Keeps Tab inside the dialog, closes on Escape, and gives focus back on close. */
const useFocusTrap = (ref: React.RefObject<HTMLElement | null>, onClose: () => void) => {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      const focusables = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [ref, onClose]);
};

const publishedDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })
    : null;

const PageContent = ({ announcement: a, titleId }: { announcement: IAnnouncement; titleId: string }) => {
  // Sanitized by the backend (nh3 allowlist).
  const html = a.page?.html || a.body_html || "";
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!bodyRef.current) return;
    enhanceYouTubeEmbeds(bodyRef.current, (kind) => {
      recordAnnouncementEvent(a, "video_play", { position: 0, video: { provider: "youtube", kind } });
    });
    // re-run only when the page's markup changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);
  const date = publishedDate(a.starts_at);
  return (
    <>
      {a.page?.cover_image_url && (
        <img
          className={styles.cover}
          src={a.page.cover_image_url}
          alt=""
          width={1200}
          height={630}
          loading="lazy"
          decoding="async"
        />
      )}
      <div className={styles.tagrow}>
        <CategoryTag announcement={a} />
      </div>
      <h1 id={titleId}>{a.page?.title || a.title}</h1>
      {date && <div className={styles.date}>{T.publishedOn(date)}</div>}
      <div ref={bodyRef} className={styles.mdBody} dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
};

export default function AnnouncementDialog({ announcement, loading, onClose, onPrimary }: DialogProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useScrollLock();
  useFocusTrap(sheetRef, onClose);

  const button = announcement?.button;
  const showFooter = button && button.style !== "hidden" && button.action.type !== "page" && button.action.type !== "none";

  return createPortal(
    <div className={styles.layer} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={announcement ? titleId : undefined}
        aria-label={announcement ? undefined : T.carousel}
        aria-busy={loading}
        style={announcement ? colorVars(announcement) : undefined}
      >
        <div className={styles.sheetClose}>
          <button type="button" className={styles.round} aria-label={T.close} onClick={onClose}>
            <CloseGlyph />
          </button>
        </div>
        <div className={styles.md}>
          {announcement ? (
            <PageContent announcement={announcement} titleId={titleId} />
          ) : (
            <p className={styles.status}>{loading ? T.loading : T.notFound}</p>
          )}
        </div>
        {announcement && showFooter && (
          <div className={styles.foot}>
            <ActionControl
              action={button.action}
              className={styles.cta}
              onActivate={() => onPrimary(announcement)}
            >
              {button.label}
              <ButtonIcon button={button} />
            </ActionControl>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ---------- form dialog ----------

const API_ORIGIN = new URL(ANNOUNCEMENTS_API_BASE).origin;

interface FormMessage {
  type: "rc-form";
  event: "ready" | "step" | "submitted" | "close" | "resize";
  slug: string;
  step?: number;
  height?: number;
}

const currentTheme = (): "dark" | "light" =>
  document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";

/** The site theme, following later changes to <html data-theme>. */
const useSiteTheme = () => {
  const [theme, setTheme] = useState(currentTheme);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(currentTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return theme;
};

interface FormDialogProps {
  slug: string;
  announcementSlug: string;
  onClose: () => void;
}

/**
 * A form, poll or questionnaire served by the backend, in an iframe sized by its own
 * `resize` messages (no inner scrollbar). Messages are trusted only from the API origin
 * and this iframe.
 */
export function FormDialog({ slug, announcementSlug, onClose }: FormDialogProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const theme = useSiteTheme();
  const [ready, setReady] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  const props = { form_slug: slug, announcement_slug: announcementSlug };

  const close = useCallback(() => {
    trackForm("form_closed", props);
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, slug, announcementSlug]);

  useScrollLock();
  useFocusTrap(sheetRef, close);

  useEffect(() => {
    trackForm("form_opened", props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // A new theme reloads the page with it: show the skeleton until it is ready again.
  useEffect(() => setReady(false), [theme]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== API_ORIGIN || e.source !== frameRef.current?.contentWindow) return;
      const msg = e.data as FormMessage;
      if (!msg || msg.type !== "rc-form" || msg.slug !== slug) return;
      if (msg.event === "ready") setReady(true);
      if (typeof msg.height === "number" && msg.height > 0) setHeight(Math.ceil(msg.height));
      if (msg.event === "step") trackForm("form_step", { ...props, step: msg.step });
      if (msg.event === "submitted") trackForm("form_submitted", props);
      if (msg.event === "close") close();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, close]);

  return createPortal(
    <div className={styles.layer} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        ref={sheetRef}
        className={`${styles.sheet} ${styles.formSheet}`}
        role="dialog"
        aria-modal="true"
        aria-label={T.formDialog}
        aria-busy={!ready}
      >
        <div className={styles.sheetClose}>
          <button type="button" className={styles.round} aria-label={T.close} onClick={close}>
            <CloseGlyph />
          </button>
        </div>
        {!ready && (
          <div className={styles.formSkeleton} role="status" aria-label={T.formLoading}>
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        <iframe
          ref={frameRef}
          key={theme}
          className={styles.formFrame}
          src={formPageUrl(slug, theme)}
          title={T.formFrame}
          // collapsed (but loading) behind the skeleton until the form says it is ready
          style={ready ? { height: height ?? 320 } : { height: 0, visibility: "hidden" }}
          sandbox="allow-scripts allow-same-origin allow-forms"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>,
    document.body,
  );
}
