import { describe, it, expect } from "vitest";
import { pickStationHintTargets } from "@/utils/domHints";

// Reproduces PostHog issue 019d7f15: "Cannot read properties of undefined
// (reading 'scrollIntoView')" — handleNoStationClicked hard-indexed
// stationItems[1] / stationItems[2] which is undefined when fewer than 2-3
// station items are rendered.

describe("pickStationHintTargets", () => {
  it("returns nulls for an empty list (the crash case: no stations rendered)", () => {
    expect(pickStationHintTargets([])).toEqual({
      scrollTarget: null,
      appendTarget: null,
    });
  });

  it("clamps to the only item when a single station is rendered", () => {
    const a = { id: "a" };
    expect(pickStationHintTargets([a])).toEqual({
      scrollTarget: a,
      appendTarget: a,
    });
  });

  it("uses index 1 for scroll and clamps append to last when 2 items", () => {
    const a = { id: 0 };
    const b = { id: 1 };
    expect(pickStationHintTargets([a, b])).toEqual({
      scrollTarget: b,
      appendTarget: b,
    });
  });

  it("uses index 1 and 2 when 3+ items (original behaviour preserved)", () => {
    const items = [{ i: 0 }, { i: 1 }, { i: 2 }, { i: 3 }];
    expect(pickStationHintTargets(items)).toEqual({
      scrollTarget: items[1],
      appendTarget: items[2],
    });
  });

  it("works on an array-like NodeList shape", () => {
    const nodeList = { length: 2, 0: "x", 1: "y" } as ArrayLike<string>;
    expect(pickStationHintTargets(nodeList)).toEqual({
      scrollTarget: "y",
      appendTarget: "y",
    });
  });
});
