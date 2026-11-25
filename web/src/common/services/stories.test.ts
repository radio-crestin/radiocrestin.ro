// Reading the stories API for the share page, against fixture JSON.
import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "@/components/Story/fixtures/stories.json";
import { fetchStory, getStoriesForBuild, sendStoryEvents } from "@/services/stories";

const respond = (status: number, body: unknown) =>
  vi.fn(async () => ({ ok: status >= 200 && status < 300, status, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) }));

afterEach(() => vi.unstubAllGlobals());

describe("fetchStory", () => {
  it("returns the story's view", async () => {
    const fetchMock = respond(200, fixture.stories[0]);
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchStory("concert-craciun-2026");
    expect(result).toMatchObject({ slug: "concert-craciun-2026", title: "Concert de Crăciun" });
    expect((fetchMock.mock.calls[0] as any)[0]).toBe("https://api.radiocrestin.ro/api/v1/stories/concert-craciun-2026/");
  });
  it("an unknown slug, an expired story or a bad slug is gone", async () => {
    vi.stubGlobal("fetch", respond(404, { error: "not found" }));
    expect(await fetchStory("nu-exista")).toBe("gone");
    vi.stubGlobal("fetch", respond(200, { ...fixture.stories[0], ends_at: "2021-01-01T00:00:00Z" }));
    expect(await fetchStory("concert-craciun-2026")).toBe("gone");
    expect(await fetchStory("../etc")).toBe("gone");
  });
  it("a server or network error is an error, not gone", async () => {
    vi.stubGlobal("fetch", respond(503, "down"));
    expect(await fetchStory("concert-craciun-2026")).toBe("error");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    expect(await fetchStory("concert-craciun-2026")).toBe("error");
  });
});

describe("getStoriesForBuild", () => {
  it("builds the live listed stories", async () => {
    const future = { ...fixture.stories[0], slug: "mai-tarziu", starts_at: "2999-01-01T00:00:00Z" };
    vi.stubGlobal("fetch", respond(200, { ...fixture, stories: [fixture.stories[0], future] }));
    expect((await getStoriesForBuild()).map((s) => s.slug)).toEqual(["concert-craciun-2026"]);
  });
  it("never fails the build", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", respond(404, "Not Found"));
    expect(await getStoriesForBuild()).toEqual([]);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ENOTFOUND"); }));
    expect(await getStoriesForBuild()).toEqual([]);
  });
});

describe("sendStoryEvents", () => {
  it("posts the events as text/plain and returns the fresh like counts", async () => {
    const fetchMock = respond(200, { status: "ok", accepted: 1, like_counts: { "concert-craciun-2026": 153 }, liked: ["concert-craciun-2026"] });
    vi.stubGlobal("fetch", fetchMock);
    const answer = await sendStoryEvents([{ type: "like", story: "concert-craciun-2026" }], "user_1");
    expect(answer?.like_counts?.["concert-craciun-2026"]).toBe(153);
    const [url, init] = fetchMock.mock.calls[0] as any;
    expect(url).toBe("https://api.radiocrestin.ro/api/v1/stories/events/");
    expect(init.method).toBe("POST");
    expect(init.headers["content-type"]).toMatch(/^text\/plain/);
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ device_id: "user_1", platform: "web", events: [{ type: "like", story: "concert-craciun-2026" }] });
    expect(typeof body.events[0].at).toBe("string");
  });
  it("is quiet when it fails or has nothing to send", async () => {
    vi.stubGlobal("fetch", respond(429, "slow down"));
    expect(await sendStoryEvents([{ type: "share", story: "x" }], "user_1")).toBeNull();
    expect(await sendStoryEvents([], "user_1")).toBeNull();
  });
});
