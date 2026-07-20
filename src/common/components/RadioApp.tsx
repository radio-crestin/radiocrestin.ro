import React, { useContext, useEffect, useRef } from "react";
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
import WhatsAppBibleGroup from "@/components/WhatsAppBibleGroup";
import StationReviewsSection from "@/components/Reviews/StationReviewsSection";
import { Context } from "@/context/ContextProvider";
import type { IStation } from "@/models/Station";
import { initPostHog } from "@/utils/posthog";
import { stationTitle } from "@/utils/seo";

interface RadioAppProps {
  stations: IStation[];
  selectedStation?: IStation | null;
  showReviews?: boolean;
}

function RadioContent({ showReviews }: { showReviews: boolean }) {
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
      {!ctx.selectedStation && <WhatsAppBibleGroup />}
      {ctx.selectedStation && <WhatsAppBibleGroup />}
      <Stations />
      <DownloadAppBanner />
      {showReviews && ctx.selectedStation && (
        <StationReviewsSection
          stationId={ctx.selectedStation.id}
          stationTitle={ctx.selectedStation.title}
          stationSlug={ctx.selectedStation.slug}
        />
      )}
      <FooterLinks showStoreBadges={false} />
      {ctx.selectedStation && <RadioPlayer />}
      <ToastContainer />
    </NoInternetConnection>
  );
}

export default function RadioApp({
  stations,
  selectedStation = null,
  showReviews = false,
}: RadioAppProps) {
  const initialState = {
    stations,
    selectedStation,
    favouriteStations: [],
  };

  return (
    <ContextProvider initialState={initialState}>
      <RadioContent showReviews={showReviews} />
    </ContextProvider>
  );
}
