import { useCallback, useRef } from "react";
import type { ClickTarget, IAnnouncement, IAnnouncementAction } from "@/models/Announcement";
import { recordAnnouncementEvent } from "@/services/announcements";
import useAnnouncementsStore from "@/store/useAnnouncementsStore";
import { openAnnouncementPage, openForm } from "@/store/useAnnouncementsUi";
import { resolveWebAction } from "@/utils/announcements";
import { shareLink } from "./share";
import { decidedAnnouncements } from "./view";

/** Runs an action that wasn't triggered by its own link (a whole-card tap). */
const followAction = (announcement: IAnnouncement, action: IAnnouncementAction | null | undefined) => {
  const resolved = resolveWebAction(action);
  if (!resolved) return;
  if (resolved.kind === "page") openAnnouncementPage(announcement.slug);
  else if (resolved.kind === "form") openForm({ slug: resolved.slug, announcementSlug: announcement.slug });
  else if (resolved.kind === "share") shareLink(resolved.url, resolved.text);
  else if (resolved.newTab) window.open(resolved.href, "_blank", "noopener,noreferrer");
  else window.location.assign(resolved.href);
};

export const hasPrimaryAction = (a: IAnnouncement) => resolveWebAction(a.button?.action) !== null;

interface Options {
  /** Set inside a station's sheet; reported with every event. */
  stationSlug?: string | null;
  positionOf: (announcement: IAnnouncement) => number;
  /** Takes the announcement out of the current view. */
  remove: (slug: string) => void;
}

/** Click, dismiss and impression handling shared by the home card and the station sheet. */
export default function useAnnouncementActions({ stationSlug = null, positionOf, remove }: Options) {
  const impressions = useRef(new Set<string>());

  const record = useCallback(
    (
      a: IAnnouncement,
      type: Parameters<typeof recordAnnouncementEvent>[1],
      extra: { target?: ClickTarget; actionType?: string | null; linkUrl?: string } = {},
    ) => recordAnnouncementEvent(a, type, { position: positionOf(a), stationSlug, ...extra }),
    [positionOf, stationSlug],
  );

  const onImpression = useCallback(
    (a: IAnnouncement) => {
      if (impressions.current.has(a.slug)) return;
      impressions.current.add(a.slug);
      // also another announcement seen, for those whose waits count impressions
      useAnnouncementsStore.getState().countImpression(a.slug, decidedAnnouncements());
      record(a, "impression");
    },
    [record],
  );

  /**
   * Counts a click for the hide rules and takes the announcement out of view when they say so.
   * Call it before recording the click. With click rules, a click before the impression's
   * one-second delay counts that impression first: else it would land after the click and count
   * as one of the reminders (impressions_after_click), which this view's impression never is.
   */
  const onClicked = useCallback(
    (a: IAnnouncement, target: ClickTarget) => {
      if (a.hide_after_clicks) onImpression(a);
      if (useAnnouncementsStore.getState().countClick(a, target)) remove(a.slug);
    },
    [onImpression, remove],
  );

  /** A button link navigates by itself; a card tap (or the page button) is followed here. */
  const onPrimary = useCallback(
    (a: IAnnouncement, target: ClickTarget) => {
      if (!hasPrimaryAction(a)) return;
      onClicked(a, target);
      record(a, "clicked", { target });
      // Links navigate by themselves; the page and the form open here.
      const opensHere = resolveWebAction(a.button?.action)?.kind !== "link";
      if (target === "card" || opensHere) followAction(a, a.button?.action);
    },
    [record, onClicked],
  );

  const onLink = useCallback(
    (a: IAnnouncement, href: string) => {
      onClicked(a, "link");
      record(a, "clicked", { target: "link", linkUrl: href });
    },
    [record, onClicked],
  );

  const onDismiss = useCallback(
    (a: IAnnouncement) => {
      useAnnouncementsStore.getState().dismiss(a.slug);
      record(a, "dismissed");
      remove(a.slug);
    },
    [record, remove],
  );

  return { onPrimary, onDismiss, onLink, onImpression, onClicked };
}
