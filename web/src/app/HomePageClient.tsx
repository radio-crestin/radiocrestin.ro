"use client";

import React from "react";
import Stations from "@/common/components/Stations/Stations";
import DownloadAppBanner from "@/common/components/DownloadAppBanner/DownloadAppBanner";
import FooterLinks from "@/common/components/FooterLinks/FooterLinks";
import HeaderHome from "@/common/components/HeaderHome/HeaderHome";
import { useStationsData } from "@/common/hooks/useStationsData";
import type { IStationExtended } from "@/common/models/Station";

interface HomePageClientProps {
  initialStations: IStationExtended[];
}

export default function HomePageClient({ initialStations }: HomePageClientProps) {
  const { stations, isLoading, error } = useStationsData(initialStations);

  return (
    <>
      <HeaderHome />
      <Stations stations={stations} />
      <DownloadAppBanner />
      <FooterLinks />
    </>
  );
}