// The build-time snapshot for the page, available to the lazily loaded announcements code.
// Main bundle: keep this file free of heavy imports.
import React, { createContext, useContext } from "react";
import type { IAnnouncement, IAnnouncementsSnapshot } from "@/models/Announcement";

export const EMPTY_SNAPSHOT: IAnnouncementsSnapshot = {
  settings: { rotation_mode: "fixed" },
  announcements: [],
  built_at: 0,
};

const SnapshotContext = createContext<IAnnouncementsSnapshot>(EMPTY_SNAPSHOT);

export function AnnouncementsProvider({
  snapshot = EMPTY_SNAPSHOT,
  children,
}: {
  snapshot?: IAnnouncementsSnapshot;
  children: React.ReactNode;
}) {
  return <SnapshotContext.Provider value={snapshot}>{children}</SnapshotContext.Provider>;
}

export const useSnapshot = () => useContext(SnapshotContext);

/** Home announcements, in snapshot order. */
export const homeItems = (snapshot: IAnnouncementsSnapshot): IAnnouncement[] =>
  snapshot.announcements.filter((a) => (a.placement ?? "home") === "home");
