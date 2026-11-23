// The announcements code that loads off the critical path (see gate.ts and index.tsx). It runs
// in React roots of its own, hydrated over the server markup, so nothing in the page's island
// (context updates, re-renders) can ever touch the card before it is ready.
import React from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import type { IAnnouncementsSnapshot } from "@/models/Announcement";
import Card, { type SlotState } from "./Card";
import { AnnouncementsProvider } from "./context";
import { StationAnnouncementsBell, type BellProps } from "./StationAnnouncements";

export interface CardRoot {
  /** The slot it renders in (null: only the dialogs, in a host of its own). */
  container: HTMLElement | null;
  /** Shows another snapshot (a station change in RadioApp): the card starts over, as on a new load. */
  show: (snapshot: IAnnouncementsSnapshot) => void;
  unmount: () => void;
}

/**
 * The card in `slot`, or, without one, just the dialogs it hosts. With `hydrate` it adopts the
 * server markup; otherwise (a slot that appeared after a station change) it renders afresh.
 */
export const mountCard = (
  slot: HTMLElement | null,
  snapshot: IAnnouncementsSnapshot,
  onSlot: (state: SlotState) => void,
  hydrate: boolean,
): CardRoot => {
  let generation = 0;
  // a new key per snapshot remounts the card, so its state (rotation anchor, page) starts over
  const tree = (s: IAnnouncementsSnapshot) => (
    <AnnouncementsProvider key={generation++} snapshot={s}>
      <Card onSlot={onSlot} />
    </AnnouncementsProvider>
  );
  const host = slot ?? document.body.appendChild(document.createElement("div"));
  let root: Root;
  if (slot && hydrate) root = hydrateRoot(slot, tree(snapshot));
  else {
    root = createRoot(host);
    root.render(tree(snapshot));
  }
  return {
    container: slot,
    show: (s) => root.render(tree(s)),
    unmount: () => {
      root.unmount();
      if (!slot) host.remove();
    },
  };
};

export const mountBell = (el: HTMLElement, snapshot: IAnnouncementsSnapshot, props: BellProps): Root =>
  hydrateRoot(
    el,
    <AnnouncementsProvider snapshot={snapshot}>
      <StationAnnouncementsBell {...props} />
    </AnnouncementsProvider>,
  );
