import stationColors from "@/data/station-colors.json";

export interface IStationColors {
  primary: string;
  secondary: string;
}

/**
 * Palette extracted from the station's logo at build time, or null when the
 * station has none. Stations with black-and-white logos are absent from the
 * generated file — they get no color wash at all rather than a muddy
 * neutral tint.
 */
export function getStationColors(
  slug: string | undefined | null
): IStationColors | null {
  if (!slug) return null;
  return (stationColors as Record<string, IStationColors>)[slug] ?? null;
}
