// Server only: the card's and bells' markup for the page. The browser later hydrates exactly
// this markup in roots of their own (lazy.tsx), so these trees must match mountCard/mountBell.
import React from "react";
import { renderToString } from "react-dom/server";
import type { IAnnouncementsSnapshot } from "@/models/Announcement";
import Card from "./Card";
import { AnnouncementsProvider } from "./context";
import { StationAnnouncementsBell, type BellProps } from "./StationAnnouncements";

export const renderCard = (snapshot: IAnnouncementsSnapshot): string =>
  renderToString(
    <AnnouncementsProvider snapshot={snapshot}>
      <Card onSlot={() => {}} />
    </AnnouncementsProvider>,
  );

export const renderBell = (snapshot: IAnnouncementsSnapshot, props: BellProps): string =>
  renderToString(
    <AnnouncementsProvider snapshot={snapshot}>
      <StationAnnouncementsBell {...props} />
    </AnnouncementsProvider>,
  );
