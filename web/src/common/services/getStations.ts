import { CONSTANTS } from "@/constants/constants";
import type { IReview, IStation } from "@/models/Station";
import { captureException } from "@/utils/posthog";
import fallbackData from "@/data/fallback-stations.json";

const API_BASE = "https://api.radiocrestin.ro/api/v1";

const getTimestamp = () => Math.floor(Date.now() / 10000) * 10;

// AbortSignal.timeout polyfill for older browsers (Safari < 16, older WebViews)
const timeoutSignal = (ms: number): AbortSignal => {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => {
    controller.abort(new DOMException("The operation timed out.", "TimeoutError"));
  }, ms);
  return controller.signal;
};

// Transient network errors (iOS background suspension, intermittent connectivity)
// are expected during long listening sessions — don't report them to PostHog.
const isTransientNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  return msg === "Load failed"              // Safari/iOS fetch failure
    || msg === "Failed to fetch"            // Chrome offline/network error
    || msg === "NetworkError when attempting to fetch resource." // Firefox
    || error.name === "AbortError"          // Request aborted
    || error.name === "TimeoutError";       // AbortSignal.timeout
};

export type IStationMetadata = Partial<IStation> & { id: number };

const getFallbackStations = () => ({
  stations: fallbackData?.data?.stations || [],
  station_groups: fallbackData?.data?.station_groups || [],
});

export const getStations = async () => {
  const endpoint = `${CONSTANTS.API_ENDPOINT}?timestamp=${getTimestamp()}`;
  const isClient = typeof window !== "undefined";
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "*/*",
      },
      signal: timeoutSignal(isClient ? 5000 : 2000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(`HTTP ${response.status} from ${endpoint}: ${body}`);
    }

    const data = await response.json();

    const stations = data?.data?.stations || [];
    if (stations.length === 0) {
      return getFallbackStations();
    }

    return {
      stations,
      station_groups: data?.data?.station_groups || [],
    };
  } catch (error) {
    if (!isTransientNetworkError(error)) {
      captureException(error, `getStations failed [${endpoint}]`);
    }
    return getFallbackStations();
  }
};

export const getStationsMetadata = async (
  changesFromTimestamp?: number,
  explicitTimestamp?: number,
): Promise<IStationMetadata[]> => {
  const ts = explicitTimestamp ?? getTimestamp();
  let endpoint = `${API_BASE}/stations-metadata?timestamp=${ts}`;
  if (changesFromTimestamp) {
    endpoint += `&changes_from_timestamp=${changesFromTimestamp}`;
  }
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "*/*",
      },
    });

    if (!response.ok) {
      // 400 usually means client clock is skewed — skip silently
      if (response.status === 400) return [];
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(`HTTP ${response.status} from ${endpoint}: ${body}`);
    }

    const data = await response.json();
    return data?.data?.stations_metadata || [];
  } catch (error) {
    if (!isTransientNetworkError(error)) {
      captureException(error, `getStationsMetadata failed [${endpoint}]`);
    }
    return [];
  }
};

export interface ISongHistoryItem {
  timestamp: string;
  listeners: number | null;
  song: {
    id: number;
    name: string;
    thumbnail_url: string | null;
    artist: {
      id: number;
      name: string;
      thumbnail_url: string | null;
    } | null;
  } | null;
}

export interface ISongHistoryResponse {
  station_id: number;
  station_slug: string;
  station_title: string;
  from_timestamp: number;
  to_timestamp: number;
  count: number;
  history: ISongHistoryItem[];
}

export const getStationSongHistory = async (
  stationSlug: string,
  fromTimestamp?: number,
  toTimestamp?: number,
): Promise<ISongHistoryResponse | null> => {
  let endpoint = `${API_BASE}/stations-metadata-history?station_slug=${encodeURIComponent(stationSlug)}`;
  if (fromTimestamp) {
    endpoint += `&from_timestamp=${fromTimestamp}`;
  }
  if (toTimestamp) {
    endpoint += `&to_timestamp=${toTimestamp}`;
  }
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { accept: "*/*" },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(`HTTP ${response.status} from ${endpoint}: ${body}`);
    }

    const data = await response.json();
    return data?.data?.stations_metadata_history || null;
  } catch (error) {
    if (!isTransientNetworkError(error)) {
      captureException(error, `getStationSongHistory failed [${stationSlug}]`);
    }
    return null;
  }
};

export const getStationReviews = async (
  stationId: number,
): Promise<IReview[]> => {
  const endpoint = `${API_BASE}/reviews?station_id=${stationId}&timestamp=${getTimestamp()}`;
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "*/*",
      },
      signal: timeoutSignal(3000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(`HTTP ${response.status} from ${endpoint}: ${body}`);
    }

    const data = await response.json();
    return data?.data?.reviews || [];
  } catch (error) {
    if (!isTransientNetworkError(error)) {
      captureException(error, `getStationReviews failed [stationId=${stationId}]`);
    }
    return [];
  }
};
