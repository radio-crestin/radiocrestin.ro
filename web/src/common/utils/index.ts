import { IStation } from "@/models/Station";

/**
 * clean the Stations metadata because the pages are rendered statically, and the metadata will pe loaded on client side.
 * @param stations
 */
export function cleanStationsMetadata(stations: IStation[]) {
  return stations.map((station: IStation) => {
    // Set song's thumbnail_url and name
    if (station.now_playing && station.now_playing.song) {
      station.now_playing.song.thumbnail_url = null;
      station.now_playing.song.name = "";
    }

    // Set artist's thumbnail_url and name
    if (
      station.now_playing &&
      station.now_playing.song &&
      station.now_playing.song.artist
    ) {
      station.now_playing.song.artist.thumbnail_url = null;
      station.now_playing.song.artist.name = "";
    }

    // Set total_listeners to 0
    station.total_listeners = 0;

    // Set is_up to true (real value will be fetched on client side)
    if (station.uptime) {
      station.uptime.is_up = true;
    }

    return station;
  });
}

export function getValidImageUrl(url: string | null | undefined, fallback: string = "/images/radio-white-default.jpg"): string {
  if (!url || url === "null" || url === "undefined" || url.trim() === "") {
    return fallback;
  }
  return url;
}
