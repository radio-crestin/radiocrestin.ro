import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock PostHog so we can assert which errors get reported vs swallowed.
const { captureExceptionMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
}));
vi.mock("@/utils/posthog", () => ({
  captureException: captureExceptionMock,
}));

import {
  getStations,
  getStationsMetadata,
  getStationReviews,
  getStationSongHistory,
  isTransientHttpStatus,
} from "@/services/getStations";

// Minimal Response-like object. `text()` returns the raw body; `json()` is
// intentionally NOT used by the code under test anymore (it parses text itself).
const makeResponse = (status: number, body: string): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    json: async () => JSON.parse(body),
  }) as unknown as Response;

const setFetch = (impl: (url: string) => Promise<Response>) => {
  (globalThis as any).fetch = vi.fn(impl);
  return (globalThis as any).fetch as ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  captureExceptionMock.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("isTransientHttpStatus", () => {
  it("treats 5xx, 429, 408, 425 as transient", () => {
    for (const s of [500, 502, 503, 504, 429, 408, 425]) {
      expect(isTransientHttpStatus(s)).toBe(true);
    }
  });
  it("does NOT treat 2xx/4xx (other than the above) as transient", () => {
    for (const s of [200, 204, 400, 401, 403, 404, 410]) {
      expect(isTransientHttpStatus(s)).toBe(false);
    }
  });
});

describe("getStations", () => {
  it("returns fallback WITHOUT reporting on upstream 503 (nginx hiccup)", async () => {
    setFetch(async () => makeResponse(503, "<html>503 Service Temporarily Unavailable</html>"));
    const result = await getStations();
    expect(Array.isArray(result.stations)).toBe(true);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("returns fallback WITHOUT reporting when a 200 body is not JSON (SyntaxError fix)", async () => {
    setFetch(async () => makeResponse(200, "<html>I am not JSON</html>"));
    const result = await getStations();
    expect(Array.isArray(result.stations)).toBe(true);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("DOES report a genuine non-transient failure (e.g. 404)", async () => {
    setFetch(async () => makeResponse(404, "nope"));
    await getStations();
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });

  it("returns parsed stations on success", async () => {
    setFetch(async () =>
      makeResponse(
        200,
        JSON.stringify({ data: { stations: [{ id: 1, slug: "a" }], station_groups: [{ id: 9 }] } }),
      ),
    );
    const result = await getStations();
    expect(result.stations).toHaveLength(1);
    expect(result.station_groups).toEqual([{ id: 9 }]);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });
});

describe("getStationsMetadata", () => {
  it("returns [] without reporting on 503", async () => {
    setFetch(async () => makeResponse(503, "<html>503</html>"));
    expect(await getStationsMetadata()).toEqual([]);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("returns [] without reporting on a non-JSON 200 body", async () => {
    setFetch(async () => makeResponse(200, "<html>not json</html>"));
    expect(await getStationsMetadata()).toEqual([]);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("returns [] without reporting on 400 (clock skew)", async () => {
    setFetch(async () => makeResponse(400, "bad request"));
    expect(await getStationsMetadata()).toEqual([]);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("returns parsed metadata on success", async () => {
    setFetch(async () =>
      makeResponse(200, JSON.stringify({ data: { stations_metadata: [{ id: 1 }] } })),
    );
    expect(await getStationsMetadata()).toEqual([{ id: 1 }]);
  });
});

describe("getStationSongHistory", () => {
  it("returns null without reporting on 502", async () => {
    setFetch(async () => makeResponse(502, "<html>502</html>"));
    expect(await getStationSongHistory("radio-a")).toBeNull();
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });
});

describe("getStationReviews", () => {
  it("does NOT fetch for stationId=0 (the station_id=0 noise)", async () => {
    const fetchMock = setFetch(async () => makeResponse(200, "{}"));
    expect(await getStationReviews(0)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("does NOT fetch for negative / NaN station ids", async () => {
    const fetchMock = setFetch(async () => makeResponse(200, "{}"));
    expect(await getStationReviews(-5)).toEqual([]);
    expect(await getStationReviews(NaN)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns [] without reporting on 503 (the dominant getStationReviews error)", async () => {
    setFetch(async () => makeResponse(503, "<html>503</html>"));
    expect(await getStationReviews(61)).toEqual([]);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("reports a genuine non-transient failure (404)", async () => {
    setFetch(async () => makeResponse(404, "missing"));
    expect(await getStationReviews(61)).toEqual([]);
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });

  it("returns parsed reviews on success", async () => {
    setFetch(async () =>
      makeResponse(200, JSON.stringify({ data: { reviews: [{ id: 1, stars: 5 }] } })),
    );
    expect(await getStationReviews(61)).toEqual([{ id: 1, stars: 5 }]);
  });
});
