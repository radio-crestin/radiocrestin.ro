import React, { useContext, useEffect } from "react";
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
import MobileAppBanner from "@/components/MobileAppBanner";
import StationReviewsSection from "@/components/Reviews/StationReviewsSection";
import { Context } from "@/context/ContextProvider";
import type { IStation } from "@/models/Station";
import { initPostHog } from "@/utils/posthog";

interface RadioAppProps {
  stations: IStation[];
  selectedStation?: IStation | null;
  showReviews?: boolean;
  hideAppBanner?: boolean;
}

function RadioContent({ showReviews, hideAppBanner }: { showReviews: boolean; hideAppBanner: boolean }) {
  const { ctx } = useContext(Context);

  useUpdateContextMetadata();
  useFavouriteStations();

  useEffect(() => {
    initPostHog();
  }, []);

  // Update document title when station changes
  useEffect(() => {
    if (ctx.selectedStation) {
      document.title = `${ctx.selectedStation.title} | Caută şi ascultă Radiouri Creştine online`;
    }
  }, [ctx.selectedStation?.title]);

  return (
    <NoInternetConnection>
      {!hideAppBanner && <MobileAppBanner />}
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
          reviewsStats={ctx.selectedStation.reviews_stats}
        />
      )}
      <FooterLinks />
      {ctx.selectedStation && <RadioPlayer />}
      <ToastContainer />
    </NoInternetConnection>
  );
}

export default function RadioApp({
  stations,
  selectedStation = null,
  showReviews = false,
  hideAppBanner = false,
}: RadioAppProps) {
  const initialState = {
    stations,
    selectedStation,
    favouriteStations: [],
  };

  return (
    <ContextProvider initialState={initialState}>
      <RadioContent showReviews={showReviews} hideAppBanner={hideAppBanner} />
    </ContextProvider>
  );
}
