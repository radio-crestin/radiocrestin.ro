export interface IStationGroup {
  id: number;
  slug: string;
  name: string;
  order: number;
  station_to_station_groups: {
    station_id: number;
  }[];
}