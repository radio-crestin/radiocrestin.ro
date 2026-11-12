import React, { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { IAnnouncement } from "@/models/Announcement";
import { getAnnouncement, recordAnnouncementEvent } from "@/services/announcements";
import useAnnouncementsUi, { closeForm, openForm } from "@/store/useAnnouncementsUi";
import { autoplaySeconds, resolveWebAction, rotateFrom, slugFromHash } from "@/utils/announcements";
import { withRenderedMarkup } from "./content";
import { homeItems } from "./context";
import { markLive, takePendingTaps } from "./gate";
import { useAnnouncements } from "./view";
import Carousel from "./Carousel";
import { StationAnnouncementsSheet } from "./StationAnnouncements";
import useAnnouncementActions from "./useAnnouncementActions";

// Most visitors never open a page or a form, so both dialogs load (in one chunk) on first use.
const AnnouncementDialog = lazy(() => import("./AnnouncementDialog"));
const FormDialog = lazy(() => import("./AnnouncementDialog").then((m) => ({ default: m.FormDialog })));

interface PageState {
  slug: string;
  announcement: IAnnouncement | null;
  loading: boolean;
}

const clearHash = () =>
  history.replaceState(history.state, "", window.location.pathname + window.location.search);

/** The page dialog for `#anunt/<slug>`, opened from a button, a card tap or a link. */
const AnnouncementPage = () => {
  const pageSlug = useAnnouncementsUi((s) => s.pageSlug);
  const [page, setPage] = useState<PageState | null>(null);

  // `#anunt/<slug>` opens the dialog; going back (or editing the hash) closes it.
  useEffect(() => {
    const syncWithHash = () => useAnnouncementsUi.setState({ pageSlug: slugFromHash(window.location.hash) });
    syncWithHash();
    window.addEventListener("hashchange", syncWithHash);
    window.addEventListener("popstate", syncWithHash);
    return () => {
      window.removeEventListener("hashchange", syncWithHash);
      window.removeEventListener("popstate", syncWithHash);
    };
  }, []);

  // The page body is only in the single-announcement response.
  useEffect(() => {
    if (!pageSlug) {
      setPage(null);
      return;
    }
    let cancelled = false;
    setPage({ slug: pageSlug, announcement: null, loading: true });
    getAnnouncement(pageSlug).then((announcement) => {
      if (cancelled) return;
      setPage({ slug: pageSlug, announcement, loading: false });
      if (announcement) recordAnnouncementEvent(announcement, "page_viewed", { position: 0 });
    });
    return () => {
      cancelled = true;
    };
  }, [pageSlug]);

  const close = useCallback(() => {
    useAnnouncementsUi.setState({ pageSlug: null });
    if (slugFromHash(window.location.hash)) clearHash();
  }, []);

  const onPrimary = useCallback((a: IAnnouncement) => {
    recordAnnouncementEvent(a, "clicked", { position: 0, target: "button" });
    const action = resolveWebAction(a.button?.action);
    if (action?.kind === "form") openForm({ slug: action.slug, announcementSlug: a.slug });
  }, []);

  if (!page) return null;
  return (
    <Suspense fallback={null}>
      <AnnouncementDialog
        announcement={page.announcement}
        loading={page.loading}
        onClose={close}
        onPrimary={onPrimary}
      />
    </Suspense>
  );
};

/** The form dialog, opened by an announcement action of type `form`. */
const FormHost = () => {
  const form = useAnnouncementsUi((s) => s.form);
  if (!form) return null;
  return (
    <Suspense fallback={null}>
      <FormDialog slug={form.slug} announcementSlug={form.announcementSlug} onClose={closeForm} />
    </Suspense>
  );
};

export interface SlotState {
  /** Nothing left to show (all dismissed): the slot collapses. */
  empty: boolean;
  /** hide_after_seconds on the only announcement: hidden, but keeps its space. */
  faded: boolean;
}

/**
 * The home announcements card, plus the page dialog, the form dialog and the station sheet.
 * Lazily loaded and hydrated over the server markup: every snapshot item is in the HTML, the
 * pre-paint style shows the right one, and the first render here matches it exactly.
 */
export default function Card({ onSlot }: { onSlot: (state: SlotState) => void }) {
  const { snapshot, visible, start, remove } = useAnnouncements();
  const items = useMemo(() => homeItems(snapshot).map(withRenderedMarkup), [snapshot]);
  // The visit's sequence: the server's order rotated to begin at the start item (SPEC "Order and
  // rotation"). It is anchored on that item when the card takes over, so dismissing one later
  // never shifts what comes next.
  const anchorRef = useRef<string | null>(null);
  if (visible && anchorRef.current === null) {
    anchorRef.current = items.filter((a) => visible.has(a.slug))[start]?.slug ?? "";
  }
  const anchor = Math.max(0, items.findIndex((a) => a.slug === anchorRef.current));
  const shown = visible ? rotateFrom(items, anchor).filter((a) => visible.has(a.slug)) : items;
  const shownRef = useRef(shown);
  shownRef.current = shown;

  const positionOf = useCallback(
    (a: IAnnouncement) => Math.max(0, shownRef.current.findIndex((x) => x.slug === a.slug)),
    [],
  );
  const actions = useAnnouncementActions({ positionOf, remove });

  const empty = visible !== null && shown.length === 0;
  useEffect(() => onSlot({ empty, faded: false }), [empty, onSlot]);
  const onExpire = useCallback(() => onSlot({ empty: false, faded: true }), [onSlot]);

  // Taken over: the server-only pre-paint rules step aside, and taps made while loading run now.
  useLayoutEffect(() => {
    if (visible === null) return;
    document.querySelectorAll("[data-ann-pp]").forEach((el) => el.removeAttribute("data-ann-pp"));
    markLive();
    for (const tap of takePendingTaps(["primary", "card", "dismiss", "link"])) {
      const a = shownRef.current.find((x) => x.slug === tap.slug);
      if (!a) continue;
      if (tap.kind === "dismiss") actions.onDismiss(a);
      else if (tap.kind === "link") recordAnnouncementEvent(a, "clicked", { position: positionOf(a), target: "button" });
      // a card tap on a link can't be replayed (it would be a pop-up); the rest open here
      else if (tap.kind === "primary" || resolveWebAction(a.button?.action)?.kind !== "link") actions.onPrimary(a, tap.kind === "card" ? "card" : "button");
    }
    // once, at takeover
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible === null]);

  return (
    <>
      {items.length > 0 && !empty && (
        <Carousel
          items={items}
          sequence={visible ? shown : null}
          autoplay={autoplaySeconds(snapshot.settings)}
          onExpire={onExpire}
          {...actions}
        />
      )}
      <AnnouncementPage />
      <FormHost />
      <StationAnnouncementsSheet />
    </>
  );
}
