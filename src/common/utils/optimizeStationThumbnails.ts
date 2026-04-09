import { getImage } from "astro:assets";
import type { IStation } from "@/models/Station";

const THUMB_WIDTH = 256;
const THUMB_HEIGHT = 256;

export async function optimizeStationThumbnails(stations: IStation[]): Promise<IStation[]> {
  const results = await Promise.allSettled(
    stations.map(async (station) => {
      if (!station.thumbnail_url || station.thumbnail_url.trim() === "") {
        return station;
      }

      try {
        const optimized = await getImage({
          src: station.thumbnail_url,
          width: THUMB_WIDTH,
          height: THUMB_HEIGHT,
          format: "webp",
        });
        return { ...station, thumbnail_url: optimized.src };
      } catch {
        // If optimization fails, keep the original URL
        return station;
      }
    })
  );

  return results.map((result, i) =>
    result.status === "fulfilled" ? result.value : stations[i]
  );
}
