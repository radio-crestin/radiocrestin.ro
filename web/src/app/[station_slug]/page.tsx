import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { seoStation } from "@/common/utils/seo";
import { getStations } from "@/common/services/getStations";
import { cleanStationsMetadata } from "@/common/utils";
import type { IStation, IStationExtended } from "@/common/models/Station";
import StationPageClient from "./StationPageClient";

interface StationPageProps {
  params: Promise<{
    station_slug: string;
  }>;
}

export async function generateStaticParams() {
  const { stations } = await getStations();

  return stations.map((station: IStation) => ({
    station_slug: station.slug,
  }));
}

export async function generateMetadata({
  params,
}: StationPageProps): Promise<Metadata> {
  const { station_slug } = await params;
  const { stations } = await getStations();

  // Add is_favorite property
  const stationsWithFavorite = stations.map((station: any) => ({
    ...station,
    is_favorite: false,
  })) as IStationExtended[];

  const selectedStation = stationsWithFavorite.find(
    (station) => station.slug === station_slug
  );

  if (!selectedStation) {
    return {};
  }

  const seo = seoStation(selectedStation);

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords?.split(","),
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: seo.fullURL,
      siteName: "Radio Creștin",
      images: [
        {
          url: seo.imageUrl,
          width: 1200,
          height: 630,
          alt: seo.title,
        },
      ],
      locale: "ro_RO",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: [seo.imageUrl],
    },
    alternates: {
      canonical: seo.fullURL,
    },
  };
}

export default async function StationPage({ params }: StationPageProps) {
  const { station_slug } = await params;
  const { stations, station_groups } = await getStations();
  // Add is_favorite property
  const stationsWithFavorite = stations.map((station: any) => ({
    ...station,
    is_favorite: false,
  })) as IStationExtended[];

  // Clean metadata for all stations
  const cleanedStations = cleanStationsMetadata(stationsWithFavorite);

  const selectedStation = cleanedStations.find(
    (station) => station.slug === station_slug
  );

  if (!selectedStation) {
    notFound();
  }


  return (
    <StationPageClient
      selectedStation={selectedStation}
      initialStations={cleanedStations}
    />
  );
}

export const dynamic = 'force-static'
