import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { captureExceptionMock, trackAnnouncementMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
  trackAnnouncementMock: vi.fn(),
}));
vi.mock("@/utils/posthog", () => ({
  captureException: captureExceptionMock,
  trackAnnouncement: trackAnnouncementMock,
  getUserId: () => "user_1",
}));

import {
  formPageUrl,
  createEventQueue,
  fetchAnnouncementsFeed,
  fetchCountry,
  getAnnouncement,
  postAnnouncementEvents,
  recordAnnouncementEvent,
} from "@/services/announcements";
import type { IAnnouncement, IAnnouncementEvent } from "@/models/Announcement";

const makeResponse = (status: number, body: string): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  }) as unknown as Response;

const setFetch = (impl: (url: string, init?: RequestInit) => Promise<Response>) => {
  const mock = vi.fn(impl);
  (globalThis as any).fetch = mock;
  return mock;
};

const setWindow = (innerWidth: number) => {
  vi.stubGlobal("window", { innerWidth });
  vi.stubGlobal("navigator", { language: "ro-RO" });
};

const event = (slug: string): IAnnouncementEvent => ({
  slug,
  type: "impression",
  position: 0,
  target: null,
  placement: "home",
  station_slug: null,
  at: "2026-11-12T10:00:00Z",
});

beforeEach(() => {
  captureExceptionMock.mockReset();
  trackAnnouncementMock.mockReset();
  setWindow(1280);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fetchAnnouncementsFeed", () => {
  it("asks for the shared list with no per-visitor parameters", async () => {
    const fetchMock = setFetch(async () => makeResponse(200, '{"announcements":[]}'));
    await fetchAnnouncementsFeed();
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe("/api/v1/announcements/");
    expect(url.search).toBe("");
  });

  it("returns the announcements and fills missing settings with defaults", async () => {
    setFetch(async () =>
      makeResponse(200, '{"settings":{"rotation_mode":"rotate"},"announcements":[{"slug":"a"}]}'),
    );
    const result = await fetchAnnouncementsFeed();
    expect(result?.settings).toEqual({ rotation_mode: "rotate" });
    expect(result?.announcements).toEqual([{ slug: "a" }]);
  });

  it("gives null on network errors, 5xx and non-JSON bodies without reporting", async () => {
    setFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await fetchAnnouncementsFeed()).toBeNull();
    setFetch(async () => makeResponse(503, "busy"));
    expect(await fetchAnnouncementsFeed()).toBeNull();
    setFetch(async () => makeResponse(200, "<html>portal</html>"));
    expect(await fetchAnnouncementsFeed()).toBeNull();
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("reports unexpected HTTP errors", async () => {
    setFetch(async () => makeResponse(400, "bad"));
    expect(await fetchAnnouncementsFeed()).toBeNull();
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });
});

describe("getAnnouncementsSnapshot", () => {
  const LIST = '{"announcements":[{"slug":"a"}]}';
  const freshSnapshot = async () => {
    vi.resetModules();
    delete (globalThis as { __announcementsSnapshot?: unknown }).__announcementsSnapshot;
    return (await import("@/services/announcements")).getAnnouncementsSnapshot;
  };
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    delete (globalThis as { __announcementsSnapshot?: unknown }).__announcementsSnapshot;
  });

  it("fetches once per build and stamps built_at", async () => {
    const fetchMock = setFetch(async () => makeResponse(200, LIST));
    const snapshot = await freshSnapshot();
    const first = await snapshot();
    expect(first.announcements).toEqual([{ slug: "a" }]);
    expect(first.built_at).toEqual(expect.any(Number));
    expect(await snapshot()).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a failed read and uses the list once it comes", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const answers = [
      async () => { throw new TypeError("fetch failed"); },
      async () => makeResponse(503, "busy"),
      async () => makeResponse(200, LIST),
    ];
    const fetchMock = setFetch(() => answers.shift()!());
    const snapshot = await freshSnapshot();
    const result = snapshot();
    await vi.runAllTimersAsync();
    expect((await result).announcements).toEqual([{ slug: "a" }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("fails the build when every try fails, saying why", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    setFetch(async () => makeResponse(200, "<html>challenge</html>"));
    const snapshot = await freshSnapshot();
    const result = snapshot();
    const failure = expect(result).rejects.toThrow(/after 3 tries.*not JSON: <html>challenge/);
    await vi.runAllTimersAsync();
    await failure;
    expect(warn).toHaveBeenCalledTimes(3);
  });

  it("falls back to an empty list on the dev server", async () => {
    vi.stubEnv("MODE", "development");
    setFetch(async () => { throw new TypeError("fetch failed"); });
    const snapshot = await freshSnapshot();
    expect((await snapshot()).announcements).toEqual([]);
  });
});

describe("fetchCountry", () => {
  it("posts an empty text/plain batch and reads the country", async () => {
    const fetchMock = setFetch(async () => makeResponse(200, '{"status":"ok","accepted":0,"country":"RO"}'));
    expect(await fetchCountry()).toBe("RO");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/announcements\/events\/$/);
    expect(init.method).toBe("POST");
    expect((init.body as Blob).type).toBe("text/plain");
    expect(JSON.parse(await (init.body as Blob).text()).events).toEqual([]);
  });

  it("tells unknown (null) from failed (undefined)", async () => {
    setFetch(async () => makeResponse(200, '{"status":"ok","accepted":0,"country":null}'));
    expect(await fetchCountry()).toBeNull();
    setFetch(async () => makeResponse(503, ""));
    expect(await fetchCountry()).toBeUndefined();
  });
});

describe("getAnnouncement", () => {
  it("fetches one announcement by slug", async () => {
    const fetchMock = setFetch(async () => makeResponse(200, '{"slug":"concert"}'));
    expect(await getAnnouncement("concert")).toEqual({ slug: "concert" });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/announcements\/concert\/$/);
  });

  it("returns null on 404 without reporting", async () => {
    setFetch(async () => makeResponse(404, '{"detail":"Not found"}'));
    expect(await getAnnouncement("gone")).toBeNull();
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });
});

describe("postAnnouncementEvents", () => {
  it("sends a text/plain beacon with the client context", async () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { language: "ro-RO", sendBeacon });
    postAnnouncementEvents([event("a")]);
    const [url, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toMatch(/\/announcements\/events\/$/);
    expect(blob.type).toBe("text/plain");
    expect(JSON.parse(await blob.text())).toEqual({
      device_id: "user_1",
      platform: "web",
      locale: "ro-RO",
      events: [event("a")],
    });
  });

  it("falls back to a keepalive fetch when the beacon is refused", () => {
    vi.stubGlobal("navigator", { language: "ro-RO", sendBeacon: () => false });
    const fetchMock = setFetch(async () => makeResponse(200, "{}"));
    postAnnouncementEvents([event("a")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", keepalive: true });
  });
});

describe("createEventQueue", () => {
  it("holds events until flushed, then sends them once", () => {
    const send = vi.fn();
    const queue = createEventQueue(send);
    queue.push(event("a"));
    queue.push(event("b"));
    expect(send).not.toHaveBeenCalled();
    queue.flush();
    expect(send).toHaveBeenCalledWith([event("a"), event("b")]);
    queue.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(queue.size()).toBe(0);
  });

  it("splits into batches of at most maxBatch events", () => {
    const send = vi.fn();
    const queue = createEventQueue(send, 2);
    ["a", "b", "c", "d", "e"].forEach((s) => queue.push(event(s)));
    queue.flush();
    expect(send.mock.calls.map(([batch]) => batch.length)).toEqual([2, 2, 1]);
  });
});

describe("recordAnnouncementEvent", () => {
  const a = {
    slug: "whatsapp",
    category: { slug: "community" },
    button: { action: { type: "external" } },
  } as unknown as IAnnouncement;

  it("queues impressions and captures them in PostHog", () => {
    const send = vi.fn();
    const queue = createEventQueue(send);
    recordAnnouncementEvent(a, "impression", { position: 1 }, queue);
    expect(queue.size()).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(trackAnnouncementMock).toHaveBeenCalledWith("impression", {
      announcement_slug: "whatsapp",
      announcement_category: "community",
      action_type: "external",
      position: 1,
      platform: "web",
      target: null,
      placement: "home",
      station_slug: null,
    });
  });

  it("flushes immediately on clicks", () => {
    const send = vi.fn();
    const queue = createEventQueue(send);
    recordAnnouncementEvent(a, "impression", { position: 0 }, queue);
    recordAnnouncementEvent(a, "clicked", { position: 0, target: "card" }, queue);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].map((e: IAnnouncementEvent) => e.type)).toEqual([
      "impression",
      "clicked",
    ]);
    expect(send.mock.calls[0][0][1].target).toBe("card");
  });

  it("records a link in the description as a click on a link, with where it goes", () => {
    const send = vi.fn();
    const queue = createEventQueue(send);
    recordAnnouncementEvent(a, "clicked", { position: 0, target: "link", linkUrl: "https://example.org/doneaza" }, queue);
    expect(send.mock.calls[0][0][0]).toMatchObject({ type: "clicked", target: "link" });
    expect(trackAnnouncementMock.mock.calls[0][1]).toMatchObject({
      target: "link",
      link_url: "https://example.org/doneaza",
    });
  });

  it("carries the placement and station of station announcements", () => {
    const send = vi.fn();
    const queue = createEventQueue(send);
    const stationAnnouncement = { ...a, placement: "station", station_slugs: ["radio-elim"] } as IAnnouncement;
    recordAnnouncementEvent(stationAnnouncement, "dismissed", { position: 2, stationSlug: "radio-elim" }, queue);
    queue.flush();
    expect(send.mock.calls[0][0][0]).toMatchObject({ placement: "station", station_slug: "radio-elim" });
    expect(trackAnnouncementMock.mock.calls[0][1]).toMatchObject({
      placement: "station",
      station_slug: "radio-elim",
    });
  });
});

describe("formPageUrl", () => {
  it("puts the theme in the query and the device context in the fragment", () => {
    const url = new URL(formPageUrl("sondaj-craciun", "light"));
    expect(url.pathname).toBe("/api/v1/forms/sondaj-craciun/page/");
    expect(url.search).toBe("?theme=light");
    expect(Object.fromEntries(new URLSearchParams(url.hash.slice(1)))).toEqual({
      device_id: "user_1",
      platform: "web",
      locale: "ro-RO",
    });
  });
});
