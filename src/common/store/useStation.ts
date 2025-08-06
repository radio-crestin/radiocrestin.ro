import { create } from "zustand";
import { IStationExtended } from "@/common/models/Station";

export interface IStationStore {
  currentStation: IStationExtended | null;
  allStations: IStationExtended[];
  setCurrentStation: (station: IStationExtended) => void;
  setAllStations: (stations: IStationExtended[]) => void;
}

const useStation = create<IStationStore>((set) => ({
  currentStation: null,
  allStations: [],
  
  setCurrentStation: (station: IStationExtended) => {
    set({ currentStation: station });
  },
  
  setAllStations: (stations: IStationExtended[]) => {
    set({ allStations: stations });
  },
}));

export default useStation;