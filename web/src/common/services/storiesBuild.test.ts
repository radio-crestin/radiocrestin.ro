import { describe, it, expect, vi, beforeEach } from "vitest";

// The share pages (/poveste/<slug>/) are built from GET /api/v1/stories/ (backend/docs/stories-api.md).
const load = async (impl: () => Promise<Response>) => {
  vi.resetModules();
  (globalThis as any).fetch = vi.fn(impl);
  return import("@/services/storiesBuild");
};

const json = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

const story = (slug: string, extra: Record<string, unknown> = {}) => ({
  slug,
  title: `Story ${slug}`,
  cover_url: null,
  share_url: `https://www.radiocrestin.ro/poveste/${slug}/`,
  slides: [{ id: 1, type: "video", media_url: "https://cdn.example/v.mp4", poster_url: "https://cdn.example/p.jpg" }],
  ...extra,
});

describe("getStoriesForBuild", () => {
  beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));

  it("keeps stories with a safe slug and only http(s) media", async () => {
    const { getStoriesForBuild } = await load(async () => json(200, {
      settings: {},
      stories: [
        story("concert", { cover_url: "javascript:alert(1)" }),
        story("Bad Slug"),
        story("../etc"),
        { slug: "no-title" },
      ],
    }));

    const stories = await getStoriesForBuild();

    expect(stories.map((s) => s.slug)).toEqual(["concert"]);
    expect(stories[0].cover_url).toBeNull();
    expect(stories[0].slides[0].poster_url).toBe("https://cdn.example/p.jpg");
  });

  it("builds no share pages when the API fails, instead of failing the build", async () => {
    const notFound = await load(async () => json(404, { error: "not found" }));
    expect(await notFound.getStoriesForBuild()).toEqual([]);

    const offline = await load(async () => { throw new TypeError("fetch failed"); });
    expect(await offline.getStoriesForBuild()).toEqual([]);
  });
});

describe("storyImage", () => {
  it("uses the cover, else the first slide's image or poster", async () => {
    const { storyImage } = await load(async () => json(200, {}));
    const base = { slug: "s", title: "S", share_url: "" };
    expect(storyImage({ ...base, cover_url: "https://c/cover.jpg", slides: [] })).toBe("https://c/cover.jpg");
    expect(storyImage({ ...base, cover_url: null, slides: [
      { id: 1, type: "youtube", media_url: null, poster_url: "https://i.ytimg.com/vi/x/hqdefault.jpg" },
    ] })).toBe("https://i.ytimg.com/vi/x/hqdefault.jpg");
    expect(storyImage({ ...base, cover_url: null, slides: [
      { id: 1, type: "image", media_url: "https://c/slide.png", poster_url: null },
    ] })).toBe("https://c/slide.png");
    expect(storyImage({ ...base, cover_url: null, slides: [] })).toBeNull();
  });
});
