import React from "react";
import { Metadata } from "next";
import { SEO_DEFAULT } from "@/common/utils/seo";
import { getStations } from "@/common/services/getStations";
import { cleanStationsMetadata } from "@/common/utils";
import type { IStationExtended } from "@/common/models/Station";
import HomePageClient from "./HomePageClient";

export const metadata: Metadata = {
  title: SEO_DEFAULT.title,
  description: SEO_DEFAULT.description,
};

export default async function HomePage() {
  // Fetch stations data on the server
  const { stations } = await getStations();

  // Add is_favorite property
  const stationsWithFavorite = stations.map((station: any) => ({
    ...station,
    is_favorite: false,
  })) as IStationExtended[];

  const cleanedStations = cleanStationsMetadata(stationsWithFavorite);

  return <HomePageClient initialStations={cleanedStations} />;
}

export const dynamic = 'force-static'
