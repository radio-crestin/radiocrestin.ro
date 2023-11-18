import { getStations } from "@/services/getStations";
import { IStation } from "@/models/Station";
import React from "react";
import { cleanStationsMetadata } from "@/utils/cleanStationsMetadata";
import Layout from "@/components/Layout";
import useFetchAndUpdateStations from "@/hooks/useFetchAndUpdateStations";
import { seoStation } from "@/utils/seo";
import dynamic from "next/dynamic";
import Header from "@/components/Header";
import Stations from "@/components/Stations";
import DownloadAppBanner from "@/components/DownloadAppBanner";

const RadioPlayer = dynamic(() => import("@/components/RadioPlayer"), {
  ssr: false,
});
export default function StationPage({
  stations_BE,
  station_slug,
}: {
  stations_BE: IStation[];
  station_slug: string;
}) {
  const stations = useFetchAndUpdateStations(stations_BE);
  // @ts-ignore
  const selectedStation: IStation = stations.find(
    (s) => s.slug === station_slug,
  );
  const seo = seoStation(selectedStation);

  return (
    <Layout {...seo}>
      <Header selectedStation={selectedStation} />
      <Stations stations={stations} />
      <DownloadAppBanner />
      <RadioPlayer stations={stations} />
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

  if (!stationData) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      stations_BE: stations_without_meta,
      station_slug,
    },
  };
}
