"use client";

import React from "react";
import Header from "@/common/components/Header/Header";
import Stations from "@/common/components/Stations/Stations";
import DownloadAppBanner from "@/common/components/DownloadAppBanner/DownloadAppBanner";
import FooterLinks from "@/common/components/FooterLinks/FooterLinks";
import RadioPlayer from "@/common/components/RadioPlayer/RadioPlayer";
import { SelectedStationProvider } from "@/common/providers/SelectedStationProvider";
import { useStationsData } from "@/common/hooks/useStationsData";
import type { IStationExtended } from "@/common/models/Station";

interface StationPageClientProps {
  selectedStation: IStationExtended;
  initialStations: IStationExtended[];
}

export default function StationPageClient({
  selectedStation,
  initialStations,
}: StationPageClientProps) {
  const { stations, isLoading, error } = useStationsData(initialStations);

  return (
    <SelectedStationProvider initialStation={selectedStation} initialStations={stations}>
      <Header selectedStation={selectedStation} />
      <Stations stations={stations} />
      <DownloadAppBanner />
      <FooterLinks />
      <RadioPlayer initialStation={selectedStation} />
    </SelectedStationProvider>
  );
}