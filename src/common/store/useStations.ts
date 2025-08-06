import { create } from 'zustand';
import { getStations } from '@/common/services/getStations';
import { IStationExtended } from '@/common/models/Station';

interface StationsState {
  stations: IStationExtended[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number;
  intervalId: NodeJS.Timeout | null;
  
  // Actions
  fetchStations: () => Promise<void>;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
  setStations: (stations: IStationExtended[]) => void;
}

const REFRESH_INTERVAL = 10000; // 10 seconds
const MIN_FETCH_INTERVAL = 5000; // Minimum 5 seconds between fetches to prevent spam

const useStations = create<StationsState>((set, get) => ({
  stations: [],
  isLoading: false,
  error: null,
  lastFetch: 0,
  intervalId: null,

  fetchStations: async () => {
    const now = Date.now();
    
    // Prevent too frequent API calls
    if (now - get().lastFetch < MIN_FETCH_INTERVAL) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const data = await getStations();
      if (!data.stations || data.stations.length === 0) {
        throw new Error('No stations found in the response');
      }
      
      // Add is_favorite property to match expected interface
      const stationsWithFavorite = data.stations.map((station: any) => ({
        ...station,
        is_favorite: false,
      })) as IStationExtended[];
      
      set({ 
        stations: stationsWithFavorite, 
        isLoading: false, 
        lastFetch: now 
      });
    } catch (err) {
      set({ 
        error: err instanceof Error ? err.message : 'Failed to fetch stations',
        isLoading: false 
      });
    }
  },

  startAutoRefresh: () => {
    const { intervalId, fetchStations } = get();
    
    // Don't start multiple intervals
    if (intervalId) return;
    
    // Initial fetch
    fetchStations();
    
    // Set up interval for periodic refresh
    const newIntervalId = setInterval(() => {
      fetchStations();
    }, REFRESH_INTERVAL);
    
    set({ intervalId: newIntervalId });
  },

  stopAutoRefresh: () => {
    const { intervalId } = get();
    if (intervalId) {
      clearInterval(intervalId);
      set({ intervalId: null });
    }
  },

  setStations: (stations: IStationExtended[]) => {
    set({ stations });
  },
}));

export default useStations;