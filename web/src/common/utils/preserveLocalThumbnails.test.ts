import { describe, it, expect } from "vitest";
import { preserveLocalThumbnails } from "@/utils";
import type { IStation } from "@/models/Station";

const station = (id: number, slug: string, thumbnail_url: string): IStation =>
  ({ id, slug, title: slug, thumbnail_url }) as IStation;

describe("preserveLocalThumbnails", () => {
  it("keeps the build-time local thumbnail when the API returns a cdn URL", () => {
    const prev = [station(0, "aripi-spre-cer", "/station-thumbnails/aripi-spre-cer.webp")];
    const next = [station(0, "aripi-spre-cer", "https://cdn.radiocrestin.ro/?url=x.png")];
    expect(preserveLocalThumbnails(prev, next)[0].thumbnail_url).toBe(
      "/station-thumbnails/aripi-spre-cer.webp",
    );
  });

  it("works for station id 0", () => {
    // ids start at zero — a truthiness guard on id would skip this station
    const prev = [station(0, "a", "/station-thumbnails/a.webp")];
    const next = [station(0, "a", "https://cdn.radiocrestin.ro/?url=a.png")];
    expect(preserveLocalThumbnails(prev, next)[0].thumbnail_url).toBe("/station-thumbnails/a.webp");
  });

  it("leaves stations added after the build (no local file) on their API URL", () => {
    const prev = [station(1, "a", "/station-thumbnails/a.webp")];
    const next = [
      station(1, "a", "https://cdn.radiocrestin.ro/?url=a.png"),
      station(99, "new-station", "https://cdn.radiocrestin.ro/?url=new.png"),
    ];
    const out = preserveLocalThumbnails(prev, next);
    expect(out[0].thumbnail_url).toBe("/station-thumbnails/a.webp");
    expect(out[1].thumbnail_url).toBe("https://cdn.radiocrestin.ro/?url=new.png");
  });

  it("does not resurrect cdn URLs from prev (only local paths are preserved)", () => {
    const prev = [station(1, "a", "https://cdn.radiocrestin.ro/?url=old.png")];
    const next = [station(1, "a", "https://cdn.radiocrestin.ro/?url=new.png")];
    expect(preserveLocalThumbnails(prev, next)[0].thumbnail_url).toBe(
      "https://cdn.radiocrestin.ro/?url=new.png",
    );
  });

  it("matches by id even if the slug changed since the build", () => {
    const prev = [station(2, "old-slug", "/station-thumbnails/old-slug.webp")];
    const next = [station(2, "new-slug", "https://cdn.radiocrestin.ro/?url=x.png")];
    // the old-slug file still exists in the deployed build's public dir
    expect(preserveLocalThumbnails(prev, next)[0].thumbnail_url).toBe(
      "/station-thumbnails/old-slug.webp",
    );
  });

  it("returns next untouched when prev is empty", () => {
    const next = [station(1, "a", "https://cdn.radiocrestin.ro/?url=a.png")];
    expect(preserveLocalThumbnails([], next)).toBe(next);
  });

  it("does not mutate the incoming station objects", () => {
    const prev = [station(1, "a", "/station-thumbnails/a.webp")];
    const apiStation = station(1, "a", "https://cdn.radiocrestin.ro/?url=a.png");
    preserveLocalThumbnails(prev, [apiStation]);
    expect(apiStation.thumbnail_url).toBe("https://cdn.radiocrestin.ro/?url=a.png");
  });
});
