import React, { useEffect, useState } from 'react';
import { Box, Container } from '@chakra-ui/react';
import dynamic from 'next/dynamic';

import StationHomepageHeader from '@/components/StationHomepageHeader/StationHomepageHeader';
import StationList from '@/components/StationList/StationList';
import { IStation } from "@/models/Station";
import { seoStation } from "@/utils/seo";
import { getStations } from "@/common/services/getStations";
import { cleanStationsMetadata } from "@/utils/cleanStationsMetadata";
import Layout from "@/components/Layout";

const StationPlayer = dynamic(() => import('@/components/StationPlayer'), {
  ssr: false,
});

export default function StationPage({
  stations_BE,
  station_slug,
  fullURL,
}: {
  stations_BE: IStation[];
  station_slug?: string;
  fullURL: string;
}) {
  const [stations, setStations] = useState<IStation[]>(stations_BE);

  useEffect(() => {
    const fetchStationsData = async () => {
      try {
        const data = await getStations();
        if (data?.stations && data?.stations.length > 0) {
          setStations(data.stations);
        }
      } catch (error) {
        console.error("Failed to fetch stations:", error);
      }
    };
    fetchStationsData();
    const intervalId = setInterval(fetchStationsData, 10000);

    return () => clearInterval(intervalId);
  }, []);

  // @ts-ignore
  const selectedStation: IStation = stations.find(s => s.slug === station_slug);
  const seo = seoStation(selectedStation);

  return (
    <Layout {...seo}>
      {selectedStation && (
        <StationHomepageHeader selectedStation={selectedStation} />
      )}
      <StationList
        stations={stations}
      />
      <Box mb={{ base: 40, lg: 20 }} />
      <StationPlayer stations={stations} />
    </Layout>
  );
}

export async function getStaticPaths() {
  const stations_metadata = await getStations();

  // Generate the paths for each station
  const paths = stations_metadata.stations.map((station: IStation) => ({
    params: { station_slug: station.slug },
  }));

  return {
    paths,
    fallback: false,
  };
}

export async function getStaticProps(context: any) {
  const stations_metadata = await getStations();
  const { station_slug } = context.params;
  const stationData = stations_metadata.stations.find(
    (station: IStation) => station.slug === station_slug,
  );
  const stations_without_meta = cleanStationsMetadata(stations_metadata.stations);

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