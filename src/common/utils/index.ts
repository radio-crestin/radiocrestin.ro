import { IStation } from "@/models/Station";

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
