import React from "react";

import { getStations } from "@/services/getStations";
import { IStation } from "@/models/Station";
import { cleanStationsMetadata } from "@/utils/cleanStationsMetadata";
import Layout from "@/components/Layout";
import { seoStation } from "@/utils/seo";
import Header from "@/components/Header";
import Stations from "@/components/Stations";
import DownloadAppBanner from "@/components/DownloadAppBanner";
import useUpdateContextMetadata from "@/hooks/useUpdateStationsMetadata";
import useFavouriteStations from "@/hooks/useFavouriteStations";

export default function StationPage({
  stations,
  selectedStation,
  seo,
}: {
  stations: IStation[];
  selectedStation: IStation;
  seo: any;
}) {
  useUpdateContextMetadata();
  useFavouriteStations();

  return (
    <Layout {...seo}>
      <Header />
      <Stations />
      <DownloadAppBanner />
    </Layout>
  );
}

export async function getStaticPaths() {
  const { stations } = await getStations();

  // Generate the paths for each station
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

  // @ts-ignore
  const selectedStation: IStation = stations_without_meta.find(
    (s: IStation) => s.slug === station_slug,
  );
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
      isFavouriteStationsLoaded: false,
      favouriteStations: [],
      station_slug,
    },
  };
}
