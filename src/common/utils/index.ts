import { IStationExtended } from "@/common/models/Station";

/**
 * clean the Stations metadata because the pages are rendered statically, and the metadata will pe loaded on client side.
 * @param stations
 */
export function cleanStationsMetadata(stations: IStationExtended[]) {
  return stations.map((station: IStationExtended) => {
    // Set song's thumbnail_url and name for the first now_playing entry
    if (station.now_playing?.song) {
      station.now_playing.song.thumbnail_url = null;
      station.now_playing.song.name = "";
    }

    // Set artist's thumbnail_url and name
    if (station.now_playing?.song?.artist) {
      station.now_playing.song.artist.thumbnail_url = null;
      station.now_playing.song.artist.name = "";
    }

    // Set total_listeners to 0
    station.total_listeners = null;

    return station;
  });
}

export function getStationRating(reviews: any[]) {
  const average = (arr: any[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  return (
    Math.round((average(reviews?.map((i: any) => i.stars) || []) || 0) * 10) /
    10
  );
}
