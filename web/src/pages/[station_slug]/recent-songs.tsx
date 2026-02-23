import React, { useContext } from "react";

import { getStations } from "@/services/getStations";
import { IStation } from "@/models/Station";
import { cleanStationsMetadata } from "@/utils";
import Layout from "@/components/Layout";
import { seoStation } from "@/utils/seo";
import Header from "@/components/Header";
import Stations from "@/components/Stations";
import DownloadAppBanner from "@/components/DownloadAppBanner";
import WhatsAppBibleGroup from "@/components/WhatsAppBibleGroup";
import useUpdateContextMetadata from "@/hooks/useUpdateStationsMetadata";
import useFavouriteStations from "@/hooks/useFavouriteStations";
import RadioPlayer from "@/components/RadioPlayer";
import { Context } from "@/context/ContextProvider";
import FooterLinks from "@/components/FooterLinks";
import StationReviewsSection from "@/components/Reviews/StationReviewsSection";

export default function RecentSongsPage({ seo }: { seo: any }) {
  const { ctx } = useContext(Context);
  useUpdateContextMetadata();
  useFavouriteStations();

  return (
    <Layout {...seo}>
      <Header />
      <WhatsAppBibleGroup />
      <Stations />
      <DownloadAppBanner />
      {ctx.selectedStation && (
        <StationReviewsSection
          stationId={ctx.selectedStation.id}
          stationTitle={ctx.selectedStation.title}
          stationSlug={ctx.selectedStation.slug}
          reviewsStats={ctx.selectedStation.reviews_stats}
        />
      )}
      <FooterLinks />
      {ctx.selectedStation && <RadioPlayer />}
    </Layout>
  );
}

export async function getStaticPaths() {
  const { stations } = await getStations();

  const paths = stations.map((station: IStation) => ({
    params: { station_slug: station.slug },
  }));

  return {
    paths,
    fallback: false,
  };
}

export async function getStaticProps(context: any) {
  const { stations } = await getStations();

  stations.forEach((station: IStation) => {
    station.is_favorite = false;
  });

  const { station_slug } = context.params;
  const stationData = stations.find(
    (station: IStation) => station.slug === station_slug,
  );
  const stations_without_meta = cleanStationsMetadata(stations);
  const selectedStationIndex = stations_without_meta.findIndex(
    (s: IStation) => s.slug === station_slug,
  );
  const selectedStation: IStation = stations_without_meta[selectedStationIndex];
  const seo = seoStation(selectedStation);

  if (!stationData) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      stations: stations_without_meta,
      selectedStation,
      seo,
      favouriteStations: [],
      station_slug,
    },
  };
}
