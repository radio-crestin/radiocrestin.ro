import { describe, it, expect } from "vitest";
import { getAdjacentStation } from "./stationQueue";

const st = (slug: string, is_up: boolean | null = true) => ({
  slug,
  uptime: is_up === null ? null : { is_up },
});

const all = [st("a"), st("b"), st("c"), st("d")];

describe("getAdjacentStation", () => {
  it("steps forward through the all-stations queue", () => {
    const next = getAdjacentStation({
      allStations: all,
      favouriteStations: [],
      source: "all",
      currentSlug: "b",
      direction: 1,
    });
    expect(next?.slug).toBe("c");
  });

  it("wraps around at both ends", () => {
    expect(
      getAdjacentStation({
        allStations: all,
        favouriteStations: [],
        source: "all",
        currentSlug: "d",
        direction: 1,
      })?.slug,
    ).toBe("a");
    expect(
      getAdjacentStation({
        allStations: all,
        favouriteStations: [],
        source: "all",
        currentSlug: "a",
        direction: -1,
      })?.slug,
    ).toBe("d");
  });

  it("uses the favourites queue when source is favorites", () => {
    const favs = [st("d"), st("a")];
    expect(
      getAdjacentStation({
        allStations: all,
        favouriteStations: favs,
        source: "favorites",
        currentSlug: "d",
        direction: 1,
      })?.slug,
    ).toBe("a");
    // wraps within favourites, not into the full list
    expect(
      getAdjacentStation({
        allStations: all,
        favouriteStations: favs,
        source: "favorites",
        currentSlug: "a",
        direction: 1,
      })?.slug,
    ).toBe("d");
  });

  it("falls back to all stations when favourites cannot step (0 or 1 entries)", () => {
    expect(
      getAdjacentStation({
        allStations: all,
        favouriteStations: [st("b")],
        source: "favorites",
        currentSlug: "b",
        direction: 1,
      })?.slug,
    ).toBe("c");
    expect(
      getAdjacentStation({
        allStations: all,
        favouriteStations: [],
        source: "favorites",
        currentSlug: "b",
        direction: 1,
      })?.slug,
    ).toBe("c");
  });

  it("keeps the favourites queue after the current station is unfavourited", () => {
    // current "b" no longer favourited: next lands on the first favourite,
    // prev on the last
    const favs = [st("c"), st("a")];
    expect(
      getAdjacentStation({
        allStations: all,
        favouriteStations: favs,
        source: "favorites",
        currentSlug: "b",
        direction: 1,
      })?.slug,
    ).toBe("c");
    expect(
      getAdjacentStation({
        allStations: all,
        favouriteStations: favs,
        source: "favorites",
        currentSlug: "b",
        direction: -1,
      })?.slug,
    ).toBe("a");
  });

  it("skips offline stations but keeps the current one positional", () => {
    const list = [st("a"), st("b", false), st("c", false), st("d")];
    expect(
      getAdjacentStation({
        allStations: list,
        favouriteStations: [],
        source: "all",
        currentSlug: "b",
        direction: 1,
      })?.slug,
    ).toBe("d");
  });

  it("treats missing uptime as up", () => {
    const list = [st("a"), st("b", null), st("c")];
    expect(
      getAdjacentStation({
        allStations: list,
        favouriteStations: [],
        source: "all",
        currentSlug: "a",
        direction: 1,
      })?.slug,
    ).toBe("b");
  });

  it("falls back to all stations when every favourite except the current is down", () => {
    const favs = [st("a"), st("b", false)];
    expect(
      getAdjacentStation({
        allStations: all,
        favouriteStations: favs,
        source: "favorites",
        currentSlug: "a",
        direction: 1,
      })?.slug,
    ).toBe("b");
  });

  it("uses the unfiltered queue when every station is down", () => {
    const list = [st("a", false), st("b", false), st("c", false)];
    expect(
      getAdjacentStation({
        allStations: list,
        favouriteStations: [],
        source: "all",
        currentSlug: "a",
        direction: 1,
      })?.slug,
    ).toBe("b");
  });

  it("returns null when there is nowhere to go", () => {
    expect(
      getAdjacentStation({
        allStations: [st("a")],
        favouriteStations: [],
        source: "all",
        currentSlug: "a",
        direction: 1,
      }),
    ).toBeNull();
    expect(
      getAdjacentStation({
        allStations: [],
        favouriteStations: [],
        source: "favorites",
        currentSlug: "a",
        direction: -1,
      }),
    ).toBeNull();
  });
});
