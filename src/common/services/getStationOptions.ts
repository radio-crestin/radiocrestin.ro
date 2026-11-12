import { getStations } from "@/services/getStations";
import type { IStation } from "@/models/Station";

/** {slug, title} of every station, sorted by title: all a station picker needs. */
export async function getStationOptions() {
  const { stations } = await getStations();
  return (stations as IStation[])
    .map(({ slug, title }) => ({ slug, title }))
    .sort((a, b) => a.title.localeCompare(b.title, "ro"));
}
