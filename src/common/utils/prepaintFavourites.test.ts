import { describe, it, expect, afterEach, vi } from "vitest";
import type { IStation } from "@/models/Station";
import {
  getPrepaintFavouriteStations,
  mapStampToStations,
} from "@/utils/prepaintFavourites";

const station = (id: number, slug: string) =>
  ({ id, slug, title: slug }) as unknown as IStation;

const stations = [
  station(1, "radio-gosen"),
  station(2, "aripi-spre-cer"),
  station(3, "radio-vestea-buna"),
];

describe("mapStampToStations", () => {
  it("returns [] without a stamp", () => {
    expect(mapStampToStations(undefined, stations)).toEqual([]);
    expect(mapStampToStations([], stations)).toEqual([]);
  });

  it("maps slugs to stations preserving stamp order", () => {
    const result = mapStampToStations(
      ["radio-vestea-buna", "radio-gosen"],
      stations,
    );
    expect(result.map((s) => s.slug)).toEqual([
      "radio-vestea-buna",
      "radio-gosen",
    ]);
  });

  it("drops stale slugs that have no station", () => {
    const result = mapStampToStations(
      ["radio-gosen", "no-such-radio"],
      stations,
    );
    expect(result.map((s) => s.slug)).toEqual(["radio-gosen"]);
  });
});

describe("getPrepaintFavouriteStations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns [] during SSR (no window)", () => {
    expect(getPrepaintFavouriteStations(stations)).toEqual([]);
  });

  it("maps window.__favouriteStamp when present", () => {
    vi.stubGlobal("window", {
      __favouriteStamp: ["aripi-spre-cer", "radio-gosen"],
    });
    expect(getPrepaintFavouriteStations(stations).map((s) => s.slug)).toEqual([
      "aripi-spre-cer",
      "radio-gosen",
    ]);
  });

  it("returns [] when the stamp is missing on window", () => {
    vi.stubGlobal("window", {});
    expect(getPrepaintFavouriteStations(stations)).toEqual([]);
  });
});
