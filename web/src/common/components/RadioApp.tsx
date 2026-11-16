import React, { useContext, useEffect, useMemo, useRef } from "react";
import { ContextProvider } from "@/context/ContextProvider";
import { ToastContainer } from "react-toastify";
import NoInternetConnection from "@/components/NoInternetConnection";
import useUpdateContextMetadata from "@/hooks/useUpdateStationsMetadata";
import useFavouriteStations from "@/hooks/useFavouriteStations";
import HeaderHomepage from "@/components/HeaderHomepage";
import Header from "@/components/Header";
import Stations from "@/components/Stations";
import DownloadAppBanner from "@/components/DownloadAppBanner";
import FooterLinks from "@/components/FooterLinks";
import RadioPlayer from "@/components/RadioPlayer";
import { AnnouncementsProvider } from "@/components/Announcements";
import type { IAnnouncementsSnapshot } from "@/models/Announcement";
import StationReviewsSection from "@/components/Reviews/StationReviewsSection";
import { Context } from "@/context/ContextProvider";
import type { IReview, IStation } from "@/models/Station";
import { initPostHog } from "@/utils/posthog";
import { getPrepaintFavouriteStations } from "@/utils/prepaintFavourites";
import { stationTitle } from "@/utils/seo";
import { stationFirst } from "@/utils/announcements";

interface RadioAppProps {
  stations: IStation[];
  selectedStation?: IStation | null;
  showReviews?: boolean;
  initialReviews?: IReview[];
  /** Build-time announcements snapshot (every station's), rendered into the HTML. */
  announcements?: IAnnouncementsSnapshot;
}

interface RadioContentProps {
  showReviews: boolean;
  initialStationId?: number;
  initialReviews?: IReview[];
}

function RadioContent({ showReviews, initialStationId, initialReviews }: RadioContentProps) {
  const { ctx } = useContext(Context);

  useUpdateContextMetadata();
  useFavouriteStations();

  useEffect(() => {
    initPostHog();
  }, []);

  // Update document title when station changes; restore the page's own
  // title when the station is deselected (back navigation to homepage)
  const pageTitleRef = useRef<string | null>(null);
  useEffect(() => {
    if (pageTitleRef.current === null) pageTitleRef.current = document.title;
    if (ctx.selectedStation) {
      document.title = stationTitle(ctx.selectedStation.title);
    } else {
      document.title = pageTitleRef.current;
    }
  }, [ctx.selectedStation?.title]);

  return (
    <NoInternetConnection>
      {ctx.selectedStation ? <Header /> : <HeaderHomepage />}
      <Stations />
      <DownloadAppBanner />
      {showReviews && ctx.selectedStation && (
        <StationReviewsSection
          stationId={ctx.selectedStation.id}
          stationTitle={ctx.selectedStation.title}
          stationSlug={ctx.selectedStation.slug}
          initialReviews={
            // Build-time reviews belong to the server-rendered station only;
            // after a client-side station switch the section refetches instead.
            ctx.selectedStation.id === initialStationId ? initialReviews : undefined
          }
        />
      )}
      <FooterLinks showStoreBadges={false} />
      {ctx.selectedStation && <RadioPlayer />}
      <ToastContainer />
    </NoInternetConnection>
  );
}

/**
 * The selected station's announcements lead the card. Picking a station, the player's previous /
 * next and Back change it without a page load, so the card follows it here.
 */
function SelectedStationAnnouncements({
  snapshot,
  children,
}: {
  snapshot?: IAnnouncementsSnapshot;
  children: React.ReactNode;
}) {
  const { ctx } = useContext(Context);
  const slug = ctx.selectedStation?.slug;
  const forStation = useMemo(() => snapshot && stationFirst(snapshot, slug), [snapshot, slug]);
  return <AnnouncementsProvider snapshot={forStation}>{children}</AnnouncementsProvider>;
}

export default function RadioApp({
  stations,
  selectedStation = null,
  showReviews = false,
  initialReviews,
  announcements,
}: RadioAppProps) {
  const initialState = {
    stations,
    selectedStation,
    favouriteStations: getPrepaintFavouriteStations(stations),
  };

  return (
    <ContextProvider initialState={initialState}>
      <SelectedStationAnnouncements snapshot={announcements}>
        <RadioContent
          showReviews={showReviews}
          initialStationId={selectedStation?.id}
          initialReviews={initialReviews}
        />
      </SelectedStationAnnouncements>
    </ContextProvider>
  );
}
