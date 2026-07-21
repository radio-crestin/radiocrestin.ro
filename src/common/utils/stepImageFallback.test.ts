import { describe, it, expect } from "vitest";
import { DEFAULT_RADIO_IMG, stepImageFallback } from "@/utils";

// Node test env has no HTMLImageElement — a src-holding stub is all the
// helper touches (getAttribute("src") + the src setter)
const fakeImg = (src: string) => {
  const el = {
    src,
    sets: 0,
    getAttribute: (name: string) => (name === "src" ? el.src : null),
  };
  return new Proxy(el, {
    set(target, prop, value) {
      if (prop === "src") target.sets++;
      return Reflect.set(target, prop, value);
    },
  }) as unknown as HTMLImageElement & { sets: number };
};

const SONG = "https://cdn.radiocrestin.ro/?url=song.jpg";
const STATION = "/station-thumbnails/rve-cluj.webp";

describe("stepImageFallback", () => {
  it("steps a broken song image to the station image", () => {
    const img = fakeImg(SONG);
    stepImageFallback(img, STATION);
    expect(img.src).toBe(STATION);
  });

  it("steps a broken station image to the default radio image", () => {
    const img = fakeImg(STATION);
    stepImageFallback(img, STATION);
    expect(img.src).toBe(DEFAULT_RADIO_IMG);
  });

  it("walks the full chain across successive errors: song → station → default", () => {
    const img = fakeImg(SONG);
    stepImageFallback(img, STATION);
    stepImageFallback(img, STATION);
    expect(img.src).toBe(DEFAULT_RADIO_IMG);
  });

  it("never re-sets the src once on the default (no error retry-loop)", () => {
    const img = fakeImg(DEFAULT_RADIO_IMG);
    stepImageFallback(img, STATION);
    stepImageFallback(img, STATION);
    expect(img.src).toBe(DEFAULT_RADIO_IMG);
    expect(img.sets).toBe(0);
  });

  it("goes straight to the default when no station fallback is given", () => {
    const img = fakeImg(SONG);
    stepImageFallback(img);
    expect(img.src).toBe(DEFAULT_RADIO_IMG);
  });

  it("skips missing/invalid station urls (null, empty, API junk like no_cover_image.jpg)", () => {
    for (const bad of [null, undefined, "", "null", "no_cover_image.jpg"]) {
      const img = fakeImg(SONG);
      stepImageFallback(img, bad);
      expect(img.src).toBe(DEFAULT_RADIO_IMG);
    }
  });

  it("does not retry the station image when it was already the broken src (song === station)", () => {
    // card had no song art, so its initial src was the station image itself
    const img = fakeImg(STATION);
    stepImageFallback(img, STATION);
    expect(img.src).toBe(DEFAULT_RADIO_IMG);
    expect(img.sets).toBe(1);
  });

  it("dedupes a station fallback that equals the default", () => {
    const img = fakeImg(SONG);
    stepImageFallback(img, DEFAULT_RADIO_IMG);
    expect(img.src).toBe(DEFAULT_RADIO_IMG);
    stepImageFallback(img, DEFAULT_RADIO_IMG);
    expect(img.src).toBe(DEFAULT_RADIO_IMG);
    expect(img.sets).toBe(1);
  });
});
