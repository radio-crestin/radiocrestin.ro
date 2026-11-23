import { describe, it, expect } from "vitest";
import { hlsStartVariantUrl, isHlsStartVariantUrl } from "@/utils/hlsStartVariant";

describe("hlsStartVariantUrl", () => {
  it("swaps index.m3u8 for index-2m.m3u8 on the origin, query kept", () => {
    expect(
      hlsStartVariantUrl(
        "https://hls.radiocrestin.ro/hls/radio-gosen/index.m3u8?ref=radiocrestin.ro&s=abc",
      ),
    ).toBe(
      "https://hls.radiocrestin.ro/hls/radio-gosen/index-2m.m3u8?ref=radiocrestin.ro&s=abc",
    );
  });

  it("covers the new origin host", () => {
    expect(
      hlsStartVariantUrl("https://live.radiocrestin.ro/hls/rve-oradea/index.m3u8"),
    ).toBe("https://live.radiocrestin.ro/hls/rve-oradea/index-2m.m3u8");
  });

  it("returns null for other hosts (they don't publish the variant)", () => {
    expect(
      hlsStartVariantUrl("https://example.com/hls/radio-gosen/index.m3u8"),
    ).toBeNull();
  });

  it("returns null for other playlists", () => {
    expect(
      hlsStartVariantUrl("https://hls.radiocrestin.ro/hls/radio-gosen/dvr.m3u8"),
    ).toBeNull();
    expect(
      hlsStartVariantUrl("https://hls.radiocrestin.ro/hls/radio-gosen/index-2m.m3u8"),
    ).toBeNull();
  });

  it("returns null for unparseable urls", () => {
    expect(hlsStartVariantUrl("not a url")).toBeNull();
  });
});

describe("isHlsStartVariantUrl", () => {
  it("recognizes the variant, with or without query", () => {
    expect(
      isHlsStartVariantUrl("https://hls.radiocrestin.ro/hls/radio-gosen/index-2m.m3u8?s=abc"),
    ).toBe(true);
    expect(
      isHlsStartVariantUrl("https://hls.radiocrestin.ro/hls/radio-gosen/index.m3u8"),
    ).toBe(false);
    expect(isHlsStartVariantUrl("not a url")).toBe(false);
  });
});
