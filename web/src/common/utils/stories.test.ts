// The story share page's view of the API (backend/docs/stories-api.md), from fixture JSON.
import { describe, expect, it } from "vitest";
import fixture from "@/components/Story/fixtures/stories.json";
import { appLinks, cssColor, ctaLink, formatStoryCount, isStoryLive, orderBubbles, safeHttpUrl, seoStory, toStoryBubble, toStoryView } from "@/utils/stories";

const story = () => structuredClone(fixture.stories[0]) as any;

describe("toStoryView", () => {
  it("shows every slide type of the contract's example", () => {
    const view = toStoryView(story())!;
    expect(view.slug).toBe("concert-craciun-2026");
    expect(view.title).toBe("Concert de Crăciun");
    expect(view.cover).toBe("https://cdn.radiocrestin.ro/stories/covers/concert.webp");
    expect(view.shareUrl).toBe("https://www.radiocrestin.ro/poveste/concert-craciun-2026/");
    expect(view.slides.map((s) => s.media.kind)).toEqual(["image", "video", "youtube", "instagram"]);
    expect(view.likeCount).toBe(152);
    expect(view.slides.map((s) => s.duration)).toEqual([6, 14.5, 30, 10]);
    expect(view.slides.map((s) => s.hasSound)).toEqual([false, true, false, false]);
    expect(view.slides[1].media).toMatchObject({ kind: "video", poster: "https://cdn.radiocrestin.ro/stories/posters/teaser.jpg" });
    expect(view.slides[2].media).toMatchObject({ kind: "youtube", videoId: "aBcDeFgHiJk" });
    expect(view.slides[3].media).toMatchObject({
      kind: "instagram",
      url: "https://www.instagram.com/reel/C1a2B3c4D5e/",
      embedUrl: "https://www.instagram.com/reel/C1a2B3c4D5e/embed/",
      author: "radiocrestin",
    });
  });

  it("skips unknown slide types and slides without their media; nothing left: no story", () => {
    const s = story();
    s.slides[0].type = "poll";
    s.slides[1].media_url = null;
    s.slides[2].youtube_url = "javascript:alert(1)";
    s.slides[2].youtube = null;
    expect(toStoryView(s)!.slides.map((x) => x.id)).toEqual([43]);
    s.slides[3].instagram = null;
    expect(toStoryView(s)).toBeNull();
  });

  it("uses Instagram's direct media first, and the embed when there is no thumbnail", () => {
    const s = story();
    s.slides[3].instagram.media_url = "https://scontent.cdninstagram.com/v.mp4";
    s.slides[3].instagram.media_type = "video";
    expect(toStoryView(s)!.slides[3].media.kind).toBe("video");
    const t = story();
    t.slides[3].instagram.thumbnail_url = null;
    expect(toStoryView(t)!.slides[3].media).toMatchObject({ kind: "instagram", thumbnail: undefined });
  });

  it("takes the cover as the API sends it (the backend does the fallback)", () => {
    const s = story();
    s.cover_url = null;
    expect(toStoryView(s)!.cover).toBeNull();
  });

  it("keeps slide durations between 2 and 60 seconds (6 when missing)", () => {
    const s = story();
    s.slides[0].duration_seconds = 0.5;
    s.slides[2].duration_seconds = 600;
    delete s.slides[3].duration_seconds;
    expect(toStoryView(s)!.slides.map((x) => x.duration)).toEqual([2, 14.5, 60, 6]);
  });

  it("refuses unsafe slugs", () => {
    const s = story();
    s.slug = "../x";
    expect(toStoryView(s)).toBeNull();
  });
});

describe("ctaLink", () => {
  const cta = (target: any) => ({ style: "button", label: "Hai", target });
  it("maps each target type to a page link", () => {
    expect(ctaLink(cta({ type: "url", url: "https://example.org/a" }))).toEqual({ style: "button", label: "Hai", href: "https://example.org/a", external: true });
    expect(ctaLink(cta({ type: "in_app", route: "station", slug: "radio-vocea-evangheliei" }))?.href).toBe("/radio-vocea-evangheliei/");
    expect(ctaLink(cta({ type: "in_app", route: "announcement", slug: "donatii" }))?.href).toBe("/#anunt/donatii");
    expect(ctaLink(cta({ type: "story", story_slug: "alta" }))).toEqual({ style: "button", label: "Hai", href: "/poveste/alta/", external: false });
    expect(ctaLink(cta({ type: "app_link", app_url: "spotify:track:1", fallback_url: "https://open.spotify.com/track/1" }))?.href)
      .toBe("https://open.spotify.com/track/1");
  });
  it("keeps the style (an unknown one shows as a button)", () => {
    const target = { type: "url", url: "https://example.org/" };
    expect(ctaLink({ style: "swipe_up", label: "Sus", target })?.style).toBe("swipe_up");
    expect(ctaLink({ style: "both", label: "Sus", target })?.style).toBe("both");
    expect(ctaLink({ style: "sticker", label: "Sus", target })?.style).toBe("button");
  });
  it("hides what it can't open, and unsafe links", () => {
    expect(ctaLink(cta({ type: "in_app", route: "settings" }))).toBeNull();
    expect(ctaLink(cta({ type: "teleport", fallback_url: "https://example.org/" }))?.href).toBe("https://example.org/");
    expect(ctaLink(cta({ type: "url", url: "javascript:alert(1)" }))).toBeNull();
    expect(ctaLink({ style: "button", label: "", target: { type: "url", url: "https://a.b/" } })).toBeNull();
    expect(ctaLink(null)).toBeNull();
  });
});

describe("helpers", () => {
  it("isStoryLive follows starts_at <= now < ends_at", () => {
    const now = Date.parse("2026-12-10T00:00:00Z");
    expect(isStoryLive({ starts_at: null, ends_at: null }, now)).toBe(true);
    expect(isStoryLive({ starts_at: "2026-12-11T00:00:00Z", ends_at: null }, now)).toBe(false);
    expect(isStoryLive({ starts_at: null, ends_at: "2026-12-10T00:00:00Z" }, now)).toBe(false);
  });
  it("safeHttpUrl keeps http(s) only", () => {
    expect(safeHttpUrl("data:text/html,x")).toBeNull();
    expect(safeHttpUrl("https://u:p@a.b/")).toBeNull();
    expect(safeHttpUrl("https://a.b/x")).toBe("https://a.b/x");
  });
  it("appLinks opens the app or its store", () => {
    const links = appLinks("concert-craciun-2026");
    expect(links.android).toMatch(/^intent:\/\/www\.radiocrestin\.ro\/poveste\/concert-craciun-2026\/#Intent;scheme=https;package=com\.radiocrestin\.radio_crestin;/);
    expect(links.ios).toBe("radiocrestin://poveste/concert-craciun-2026");
    expect(links.iosStore).toContain("apps.apple.com");
  });
  it("seoStory has the title, cover and share URL", () => {
    const seo = seoStory(toStoryView(story())!, "https://www.radiocrestin.ro/x.png");
    expect(seo).toMatchObject({
      title: "Concert de Crăciun | Radio Creștin",
      imageUrl: "https://cdn.radiocrestin.ro/stories/covers/concert.webp",
      fullURL: "https://www.radiocrestin.ro/poveste/concert-craciun-2026/",
      twitterCard: "summary_large_image",
    });
  });
});

describe("bubbles", () => {
  const bubble = (slug: string, extra: Record<string, unknown> = {}) => toStoryBubble({ ...story(), slug, ...extra })!;
  it("a bubble has the title, cover and time window", () => {
    expect(bubble("concert-craciun-2026")).toEqual({
      slug: "concert-craciun-2026",
      title: "Concert de Crăciun",
      cover: "https://cdn.radiocrestin.ro/stories/covers/concert.webp",
      startsAt: "2020-01-01T00:00:00Z",
      endsAt: null,
      updatedAt: "2026-11-25T10:12:03Z",
    });
  });
  it("orders new stories first, seen ones after, each in the API's order; only live ones", () => {
    const a = bubble("a"), b = bubble("b"), c = bubble("c"), later = bubble("later", { starts_at: "2999-01-01T00:00:00Z" });
    const seen = { a: "2026-11-25T10:12:03Z" };
    expect(orderBubbles([a, b, c, later], seen).map((x) => x.slug)).toEqual(["b", "c", "a"]);
  });
  it("an edited story is new again", () => {
    const a = bubble("a", { updated_at: "2026-12-01T00:00:00Z" });
    expect(orderBubbles([bubble("b"), a], { a: "2026-11-25T10:12:03Z", b: "2026-11-25T10:12:03Z" }).map((x) => x.slug)).toEqual(["a", "b"]);
  });
});

describe("the app's Reels fields", () => {
  it("author, caption and comments, with the app's defaults", () => {
    const plain = toStoryView(story())!;
    expect(plain.author).toBeNull();
    expect(plain.comments).toEqual({ enabled: false, count: 0 });
    expect(plain.slides[0].caption).toBeNull();
    const s = story();
    s.author = { name: "Radio Creștin", avatar_url: "https://cdn.radiocrestin.ro/a.png" };
    s.comments = { enabled: true, placeholder: "Scrie un comentariu", count: 12 };
    s.slides[0].caption = "  Concertul de Crăciun  ";
    const view = toStoryView(s)!;
    expect(view.author).toEqual({ name: "Radio Creștin", avatar: "https://cdn.radiocrestin.ro/a.png" });
    expect(view.comments).toEqual({ enabled: true, count: 12 });
    expect(view.slides[0].caption).toBe("Concertul de Crăciun");
  });
  it("CTA colours: #RRGGBB, or #AARRGGBB as the app reads it", () => {
    expect(cssColor("#E91E63")).toBe("#e91e63");
    expect(cssColor("80FF0000")).toBe("rgba(255, 0, 0, 0.502)");
    expect(cssColor("red")).toBeUndefined();
    const cta = ctaLink({ style: "button", label: "Hai", color: "#112233", text_color: "#ffffff", target: { type: "url", url: "https://a.b/" } });
    expect(cta).toMatchObject({ color: "#112233", textColor: "#ffffff" });
  });
  it("counts with Romanian thousands, as the app", () => {
    expect(formatStoryCount(2229)).toBe("2.229");
    expect(formatStoryCount(152)).toBe("152");
    expect(formatStoryCount(1234567)).toBe("1.234.567");
  });
});
