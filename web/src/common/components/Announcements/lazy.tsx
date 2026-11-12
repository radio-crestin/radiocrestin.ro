// The announcements code that loads off the critical path (see gate.ts and index.tsx). It runs
// in React roots of its own, hydrated over the server markup, so nothing in the page's island
// (context updates, re-renders) can ever touch the card before it is ready.
import React from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import type { IAnnouncementsSnapshot } from "@/models/Announcement";
import Card, { type SlotState } from "./Card";
import { AnnouncementsProvider } from "./context";
import { StationAnnouncementsBell, type BellProps } from "./StationAnnouncements";

/** The card in `slot` (its server markup), or, without one, just the dialogs it hosts. */
export const mountCard = (
  slot: HTMLElement | null,
  snapshot: IAnnouncementsSnapshot,
  onSlot: (state: SlotState) => void,
): Root => {
  const tree = (
    <AnnouncementsProvider snapshot={snapshot}>
      <Card onSlot={onSlot} />
    </AnnouncementsProvider>
  );
  if (slot) return hydrateRoot(slot, tree);
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  root.render(tree);
  return root;
};

export const mountBell = (el: HTMLElement, snapshot: IAnnouncementsSnapshot, props: BellProps): Root =>
  hydrateRoot(
    el,
    <AnnouncementsProvider snapshot={snapshot}>
      <StationAnnouncementsBell {...props} />
    </AnnouncementsProvider>,
  );
