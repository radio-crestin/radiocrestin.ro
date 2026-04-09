import { getStations } from "@/services/getStations";
import { cleanStationsMetadata } from "@/utils";
import { optimizeStationThumbnails } from "@/utils/optimizeStationThumbnails";
import type { IStation } from "@/models/Station";

export async function getOptimizedStations(): Promise<IStation[]> {
  const { stations: rawStations } = await getStations();
  rawStations.forEach((station: IStation) => {
    station.is_favorite = false;
  });
  const cleaned = cleanStationsMetadata(rawStations);
  return optimizeStationThumbnails(cleaned);
}
