"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { IStationExtended } from "@/common/models/Station";
import { useStationsData } from "@/common/hooks/useStationsData";

interface SelectedStationContextType {
  selectedStation: IStationExtended | null;
  setSelectedStation: (station: IStationExtended) => void;
  stations: IStationExtended[];
  isLoading: boolean;
  error: string | null;
}

const SelectedStationContext = createContext<SelectedStationContextType | undefined>(undefined);

export const useSelectedStation = () => {
  const context = useContext(SelectedStationContext);
  if (!context) {
    throw new Error("useSelectedStation must be used within SelectedStationProvider");
  }
  return context;
};

interface SelectedStationProviderProps {
  children: ReactNode;
  initialStation: IStationExtended;
  initialStations: IStationExtended[];
}

export const SelectedStationProvider: React.FC<SelectedStationProviderProps> = ({
  children,
  initialStation,
  initialStations,
}) => {
  const [selectedStation, setSelectedStationState] = useState<IStationExtended | null>(initialStation);
  const { stations, isLoading, error } = useStationsData(initialStations);

  // Update selected station metadata when stations refresh
  useEffect(() => {
    if (selectedStation && stations.length > 0) {
      const updatedStation = stations.find(s => s.slug === selectedStation.slug);
      if (updatedStation) {
        setSelectedStationState(updatedStation);
      }
    }
  }, [stations, selectedStation]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname;
      const stationSlug = pathname.slice(1); // Remove leading slash
      
      if (stationSlug && stations.length > 0) {
        const station = stations.find(s => s.slug === stationSlug);
        if (station) {
          setSelectedStationState(station);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [stations]);

  const setSelectedStation = (station: IStationExtended) => {
    setSelectedStationState(station);
  };

  return (
    <SelectedStationContext.Provider
      value={{
        selectedStation,
        setSelectedStation,
        stations,
        isLoading,
        error,
      }}
    >
      {children}
    </SelectedStationContext.Provider>
  );
};