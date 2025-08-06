// Import types from generated GraphQL
import type { StationType, StationStreamType, StationNowPlayingType, StationUptimeType } from "@/lib/graphql/graphql";

// Re-export with legacy names for backward compatibility
export type IStation = StationType & {
  // Additional client-side properties
  is_favorite?: boolean;
};

export type IStationStreams = StationStreamType;

// Extended type for client usage
export interface IStationExtended extends IStation {
  is_favorite: boolean;
}
