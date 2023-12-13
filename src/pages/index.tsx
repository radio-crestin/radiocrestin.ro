import React from "react";

import { getStations } from "@/services/getStations";
import { IStation } from "@/models/Station";
import { cleanStationsMetadata } from "@/utils";
import Stations from "@/components/Stations";
import DownloadAppBanner from "@/components/DownloadAppBanner";
import useUpdateContextMetadata from "@/hooks/useUpdateStationsMetadata";
import useFavouriteStations from "@/hooks/useFavouriteStations";
import HeaderHomepage from "@/components/HeaderHomepage";
import Layout from "@/components/Layout";
import { SEO_DEFAULT } from "@/utils/seo";

export default function StationPage({ seo }: { seo: any }) {
  useUpdateContextMetadata();
  useFavouriteStations();

  return (
    <Layout {...SEO_DEFAULT}>
      <HeaderHomepage />
      <Stations />
      <DownloadAppBanner />
    </Layout>
  );
}

export async function getStaticProps(context: any) {
  const { stations } = await getStations();

  // Add is_favorite property to each station
  stations.forEach((station: IStation) => {
    station.is_favorite = false;
  });

  const stations_without_meta = cleanStationsMetadata(stations);
  return {
    props: {
      stations: stations_without_meta,
      favouriteStations: [],
    },
  };
}
