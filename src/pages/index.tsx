import React, { useContext } from "react";

import { getStations } from "@/services/getStations";
import { IStation } from "@/models/Station";
import { cleanStationsMetadata } from "@/utils";
import Stations from "@/components/Stations";
import DownloadAppBanner from "@/components/DownloadAppBanner";
import useUpdateContextMetadata from "@/hooks/useUpdateStationsMetadata";
import useFavouriteStations from "@/hooks/useFavouriteStations";
import HeaderHomepage from "@/components/HeaderHomepage";
import Header from "@/components/Header";
import Layout from "@/components/Layout";
import { SEO_DEFAULT } from "@/utils/seo";
import FooterLinks from "@/components/FooterLinks";
import RadioPlayer from "@/components/RadioPlayer";
import WhatsAppBibleGroup from "@/components/WhatsAppBibleGroup";
import { Context } from "@/context/ContextProvider";

export default function StationPage({ seo }: { seo: any }) {
  const { ctx } = useContext(Context);
  useUpdateContextMetadata();
  useFavouriteStations();

  return (
    <Layout {...SEO_DEFAULT}>
      {ctx.selectedStation ? <Header /> : <HeaderHomepage />}
      {!ctx.selectedStation && <WhatsAppBibleGroup />}
      <Stations />
      <DownloadAppBanner />
      <FooterLinks />
      {ctx.selectedStation && <RadioPlayer />}
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
