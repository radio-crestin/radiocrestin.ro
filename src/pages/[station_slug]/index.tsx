import React, { useEffect, useState } from 'react';
import { Box, Container } from '@chakra-ui/react';
import dynamic from 'next/dynamic';

import StationHomepageHeader from '@/components/StationHomepageHeader/StationHomepageHeader';
import StationGroups from '@/components/StationGroups/StationGroups';
import StationList from '@/components/StationList/StationList';
import Footer from '@/components/Footer/Footer';
import { SearchStationsModal } from '@/components/SearchStationsModal/SearchStationsModal';
import { ContactModalLink } from '@/components/ContactModalLink/ContactModalLink';
import { parse } from 'url';
import HeadContainer from '@/components/HeadContainer';
import DownloadAppBanner from '@/components/DownloadAppBanner/DownloadAppBanner';
import { IStation } from "@/models/Station";
import { IStationGroup } from "@/models/StationGroup";
import { indexBy } from "@/utils/indexBy";
import { seoStation } from "@/utils/seo";
import { ISeoMetadata } from "@/models/SeoMetadata";
import { getStations } from "@/common/frontendServices/getStations";

const StationPlayer = dynamic(() => import('@/components/StationPlayer'), {
  ssr: false,
});

export default function StationPage({
  stations_metadata,
  station_slug,
  seoMetadata,
  fullURL,
}: {
  stations_metadata: any;
  station_slug?: string;
  seoMetadata?: ISeoMetadata;
  fullURL: string;
}) {
  const [stations, setStations] = useState(stations_metadata.stations);
  const [station_groups, setStation_groups] = useState(
    stations_metadata.station_groups,
  );

  useEffect(() => {
    const fetchStations = setInterval(() => {
      fetch('/api/v1/stations').then(async r => {
        const data = await r.json();
        setStations(data.stations);
        setStation_groups(data.station_groups);
      });
    }, 10000);
    return () => clearInterval(fetchStations);
  }, []);

  // @ts-ignore
  const selectedStation: Station = stations.find(s => s.slug === station_slug);
  const seo: ISeoMetadata =
    seoMetadata ||
    seoStation(selectedStation?.title, selectedStation.description);

  return (
    <>
      <HeadContainer
        seo={seo}
        fullURL={fullURL}
        selectedStation={selectedStation}
      />
      <Container maxW={'8xl'}>
        <Box
          display={'flex'}
          alignItems={'center'}
          justifyContent={'flex-end'}
          my={4}
          gap={2}>
          <ContactModalLink />
        </Box>
        {selectedStation && (
          <StationHomepageHeader selectedStation={selectedStation} />
        )}
        <StationList
          stations={stations}
        />
        <DownloadAppBanner />
        <Footer />
        <Box mb={{ base: 40, lg: 20 }} />
        <StationPlayer stations={stations} />
      </Container>
    </>
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

  if (!stationData) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      stations_metadata,
      station_slug,
    },
  };
}
