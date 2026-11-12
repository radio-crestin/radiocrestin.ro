import { useCallback, useRef } from "react";
import type { ClickTarget, IAnnouncement, IAnnouncementAction } from "@/models/Announcement";
import { recordAnnouncementEvent } from "@/services/announcements";
import useAnnouncementsStore from "@/store/useAnnouncementsStore";
import { openAnnouncementPage, openForm } from "@/store/useAnnouncementsUi";
import { resolveWebAction } from "@/utils/announcements";

/** Runs an action that wasn't triggered by its own link (a whole-card tap). */
const followAction = (announcement: IAnnouncement, action: IAnnouncementAction | null | undefined) => {
  const resolved = resolveWebAction(action);
  if (!resolved) return;
  if (resolved.kind === "page") openAnnouncementPage(announcement.slug);
  else if (resolved.kind === "form") openForm({ slug: resolved.slug, announcementSlug: announcement.slug });
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
      extra: { target?: ClickTarget; actionType?: string | null } = {},
    ) => recordAnnouncementEvent(a, type, { position: positionOf(a), stationSlug, ...extra }),
    [positionOf, stationSlug],
  );

  /** A button link navigates by itself; a card tap (or the page button) is followed here. */
  const onPrimary = useCallback(
    (a: IAnnouncement, target: ClickTarget) => {
      if (!hasPrimaryAction(a)) return;
      record(a, "clicked", { target });
      // Links navigate by themselves; the page and the form open here.
      const opensHere = resolveWebAction(a.button?.action)?.kind !== "link";
      if (target === "card" || opensHere) followAction(a, a.button?.action);
    },
    [record],
  );

  const onDismiss = useCallback(
    (a: IAnnouncement) => {
      useAnnouncementsStore.getState().dismiss(a.slug);
      record(a, "dismissed");
      remove(a.slug);
    },
    [record, remove],
  );

  const onImpression = useCallback(
    (a: IAnnouncement) => {
      if (impressions.current.has(a.slug)) return;
      impressions.current.add(a.slug);
      useAnnouncementsStore.getState().countImpression(a.slug);
      record(a, "impression");
    },
    [record],
  );

  return { onPrimary, onDismiss, onImpression };
}
