// UI state shared by the announcements card, the station bells and the page dialog.
// The announcements themselves come from the build-time snapshot (AnnouncementsProvider).
import { create } from "zustand";
import useAnnouncementsStore from "@/store/useAnnouncementsStore";
import { ANNOUNCEMENT_HASH_PREFIX } from "@/utils/announcements";

interface StationSheet {
  stationSlug: string;
  stationTitle: string;
  /** The station's announcements, marked seen on open. */
  slugs: string[];
}

interface OpenForm {
  slug: string;
  /** The announcement whose button or card opened it. */
  announcementSlug: string;
}

interface AnnouncementsUi {
  /** Slug of the announcement whose page dialog is open. */
  pageSlug: string | null;
  stationSheet: StationSheet | null;
  form: OpenForm | null;
}

const useAnnouncementsUi = create<AnnouncementsUi>(() => ({
  pageSlug: null,
  stationSheet: null,
  form: null,
}));

export const openAnnouncementPage = (slug: string) => {
  history.pushState(history.state, "", `${ANNOUNCEMENT_HASH_PREFIX}${encodeURIComponent(slug)}`);
  useAnnouncementsUi.setState({ pageSlug: slug, stationSheet: null });
};

export const openStationSheet = (sheet: StationSheet) => {
  useAnnouncementsUi.setState({ stationSheet: sheet });
  useAnnouncementsStore.getState().markSeen(sheet.slugs);
};

export const openForm = (form: OpenForm) => useAnnouncementsUi.setState({ form, stationSheet: null });

export const closeForm = () => useAnnouncementsUi.setState({ form: null });

export const closeStationSheet = () => useAnnouncementsUi.setState({ stationSheet: null });

export default useAnnouncementsUi;
