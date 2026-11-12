// SPEC "Order and rotation": the server's order is kept, the visit starts at the rotation's item
// with the rest following in order, paging stops at the ends of that sequence, and the optional
// autoplay runs only when nobody is looking at or using the card.
import { describe, expect, it } from "vitest";
import type { IAnnouncementsSnapshot } from "@/models/Announcement";
import { autoplaySeconds, pageTarget, rotateFrom } from "@/utils/announcements";
import { renderCard } from "./ssr";
import { autoplayCanRun, type AutoplayState } from "./useAutoplay";

describe("the visit's sequence", () => {
  const order = ["a", "b", "c", "d"];

  it("is the server's order rotated to the start item", () => {
    expect(rotateFrom(order, 0)).toEqual(["a", "b", "c", "d"]);
    expect(rotateFrom(order, 2)).toEqual(["c", "d", "a", "b"]);
    expect(rotateFrom(order, 3)).toEqual(["d", "a", "b", "c"]);
    expect(rotateFrom([], 2)).toEqual([]);
    expect(order).toEqual(["a", "b", "c", "d"]); // never re-sorted in place
  });

  it("reaches every item with next, and stops at both ends", () => {
    for (let start = 0; start < order.length; start++) {
      const seq = rotateFrom(order, start);
      const visited = [seq[0]];
      let i: number | null = 0;
      while ((i = pageTarget(i, seq.length, 1)) !== null) visited.push(seq[i]);
      expect([...visited].sort()).toEqual(order);
      expect(pageTarget(0, seq.length, -1)).toBeNull();
      expect(pageTarget(seq.length - 1, seq.length, 1)).toBeNull();
    }
  });
});

describe("autoplay_seconds", () => {
  it("is off unless a positive number, and kept within 3–60", () => {
    for (const off of [undefined, null, 0, -5, "x", NaN]) expect(autoplaySeconds({ autoplay_seconds: off })).toBe(0);
    expect(autoplaySeconds(undefined)).toBe(0);
    expect(autoplaySeconds({ autoplay_seconds: 1 })).toBe(3);
    expect(autoplaySeconds({ autoplay_seconds: 8 })).toBe(8);
    expect(autoplaySeconds({ autoplay_seconds: 600 })).toBe(60);
  });
});

describe("autoplayCanRun", () => {
  const running: AutoplayState = {
    seconds: 5,
    count: 3,
    active: 0,
    reducedMotion: false,
    stopped: false,
    engaged: false,
    tabHidden: false,
    onScreen: true,
  };

  it("runs with several items, on screen, untouched", () => {
    expect(autoplayCanRun(running)).toBe(true);
    expect(autoplayCanRun({ ...running, active: 1 })).toBe(true);
  });

  it.each([
    ["off", { seconds: 0 }],
    ["a single item", { count: 1 }],
    ["before the card takes over", { active: null }],
    ["at the last item (no wrap)", { active: 2 }],
    ["reduced motion", { reducedMotion: true }],
    ["after a user page or dismiss", { stopped: true }],
    ["while hovered, touched or focused", { engaged: true }],
    ["in a background tab", { tabHidden: true }],
    ["while less than half of the card is on screen", { onScreen: false }],
  ])("waits: %s", (_, change) => {
    expect(autoplayCanRun({ ...running, ...change })).toBe(false);
  });
});

describe("the card's markup", () => {
  const snapshot = (autoplay: number) =>
    ({
      built_at: 1,
      settings: { rotation_mode: "rotate", autoplay_seconds: autoplay },
      announcements: ["a", "b", "c"].map((slug) => ({ slug, title: slug.toUpperCase(), dismissible: true })),
    }) as unknown as IAnnouncementsSnapshot;
  const slides = (html: string) => [...html.matchAll(/<section data-ann="(\w)"([^>]*)>/g)].map((m) => [m[1], m[2]]);

  it("with autoplay, lays every slide out in one cell, only the first visible", () => {
    const html = renderCard(snapshot(5));
    expect(html).toContain("ann-viewport ann-stack");
    const [first, ...rest] = slides(html);
    expect(first[0]).toBe("a");
    expect(first[1]).toContain("data-ann-a");
    expect(first[1]).not.toContain("style=");
    for (const [, attrs] of rest) {
      expect(attrs).toContain('style="--h:hidden"');
      expect(attrs).not.toContain("display:none");
    }
  });

  it("without autoplay, shows only the current slide", () => {
    const html = renderCard(snapshot(0));
    expect(html).not.toContain("ann-stack");
    const [, ...rest] = slides(html);
    for (const [, attrs] of rest) expect(attrs).toContain("display:none");
  });
});
