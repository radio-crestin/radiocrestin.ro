import { useEffect } from 'react';
import useStations from '@/common/store/useStations';
import { IStationExtended } from '@/common/models/Station';

interface UseStationsDataReturn {
  stations: IStationExtended[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to access global stations data with automatic refresh
 * This replaces the old useStationsRefresh hook with a singleton pattern
 */
export const useStationsData = (initialStations?: IStationExtended[]): UseStationsDataReturn => {
  const { 
    stations, 
    isLoading, 
    error, 
    startAutoRefresh, 
    stopAutoRefresh,
    setStations 
  } = useStations();

  useEffect(() => {
    // Set initial stations if provided and store is empty
    if (initialStations && initialStations.length > 0 && stations.length === 0) {
      setStations(initialStations);
    }

    // Start auto-refresh when component mounts
    startAutoRefresh();

    // Cleanup on unmount
    return () => {
      // Don't stop auto-refresh here as other components might be using it
      // The store will manage its own lifecycle
    };
  }, [initialStations, startAutoRefresh, setStations, stations.length]);

  // Cleanup interval when no components are using it
  useEffect(() => {
    return () => {
      // This cleanup will run when the last component using this hook unmounts
      // We could implement reference counting here if needed
    };
  }, []);

  return {
    stations,
    isLoading,
    error,
  };
};