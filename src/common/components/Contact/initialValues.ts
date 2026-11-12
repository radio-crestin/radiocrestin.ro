import type { StationOption } from "./Field";
import { fieldsOf, type ContactKind, type Values } from "./schema";

/**
 * Answers a link can fill in ahead:
 * - `?station=<slug>` picks the station on the announcement and report forms;
 * - `?type=<option>` picks what the suggestion is about (the app's
 *   "report a problem" shortcut opens the suggestion form with `type=bug`).
 */
export function initialValues(kind: ContactKind, stations: StationOption[], search: string): Values {
  const params = new URLSearchParams(search);
  const slug = params.get("station");
  const knownStation = !!slug && stations.some((s) => s.slug === slug);
  if (kind === "announcement" && knownStation) return { about: "station", station_slug: slug };
  if (kind === "report" && knownStation) return { station_slug: slug };
  if (kind === "feedback") {
    const type = params.get("type");
    const options = fieldsOf(kind).find((f) => f.name === "suggestion_type")?.options ?? [];
    if (type && options.includes(type)) return { suggestion_type: type };
  }
  return {};
}
