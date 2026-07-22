import { describe, it, expect } from "vitest";
import { stationThumb2x, stationThumbImgProps } from "@/utils";

describe("stationThumb2x", () => {
  it("derives the @2x companion for a local thumbnail", () => {
    expect(stationThumb2x("/station-thumbnails/rve-cluj.webp")).toBe(
      "/station-thumbnails/rve-cluj@2x.webp",
    );
  });

  it("is idempotent on an already-@2x url", () => {
    expect(stationThumb2x("/station-thumbnails/rve-cluj@2x.webp")).toBe(
      "/station-thumbnails/rve-cluj@2x.webp",
    );
  });

  it("returns null for remote urls (stations added after the deploy)", () => {
    expect(
      stationThumb2x("https://cdn.radiocrestin.ro/?url=x&w=250&f=webp"),
    ).toBeNull();
  });

  it("returns null for null/empty/junk", () => {
    for (const bad of [null, undefined, "", "no_cover_image.jpg"]) {
      expect(stationThumb2x(bad)).toBeNull();
    }
  });
});

describe("stationThumbImgProps", () => {
  it("builds width-descriptor srcSet + sizes for a local thumbnail", () => {
    expect(
      stationThumbImgProps("/station-thumbnails/rve-cluj.webp", 224),
    ).toEqual({
      srcSet:
        "/station-thumbnails/rve-cluj.webp 256w, /station-thumbnails/rve-cluj@2x.webp 512w",
      sizes: "224px",
    });
  });

  it("is empty for remote urls so the attributes are omitted", () => {
    expect(
      stationThumbImgProps("https://cdn.radiocrestin.ro/?url=x", 224),
    ).toEqual({});
  });

  it("is empty when the url is already the @2x file (no self-pairing)", () => {
    expect(
      stationThumbImgProps("/station-thumbnails/rve-cluj@2x.webp", 224),
    ).toEqual({});
  });

  it("is empty for null/undefined", () => {
    expect(stationThumbImgProps(null, 100)).toEqual({});
    expect(stationThumbImgProps(undefined, 100)).toEqual({});
  });
});
